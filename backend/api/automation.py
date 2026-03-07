from fastapi import APIRouter, HTTPException, Body, Request
from fastapi.responses import JSONResponse
import os
import uuid
import json
from datetime import datetime
from ping3 import ping
try:
    from netmiko import ConnectHandler, NetmikoTimeoutException, NetmikoAuthenticationException
    HAS_NETMIKO = True
except ImportError:
    HAS_NETMIKO = False

try:
    from scrapli.driver.core import AsyncIOSXEDriver, AsyncNXOSDriver, AsyncEOSDriver, AsyncJunosDriver
    from scrapli.exceptions import ScrapliException
    HAS_SCRAPLI = True
except ImportError:
    HAS_SCRAPLI = False

try:
    from scrapli_community.huawei.vrp.async_driver import AsyncHuaweiVRPDriver
    from scrapli_community.hp.comware.async_driver import AsyncHPComwareDriver
except ImportError:
    pass
from database import get_db_connection
import logging
import asyncio

from services.automation_service import AutomationService
from drivers.base import CommandResult
from services.audit_service import log_audit_event
from core.crypto import decrypt_credential

router = APIRouter()
logger = logging.getLogger(__name__)

# ── Dangerous command blacklist ──
# Commands that can cause irreversible damage to network devices.
_DANGEROUS_COMMANDS = [
    'write erase', 'erase startup', 'erase nvram', 'erase flash',
    'format ', 'delete /force', 'delete /recursive',
    'reload', 'reboot', 'reset saved-configuration',
    'restore factory-default', 'system-shutdown',
    'license boot', 'boot system',
]

def _check_command_safety(commands: list[str]) -> str | None:
    """Return an error message if any command matches the blacklist, or None if safe."""
    for cmd in commands:
        cmd_lower = cmd.lower().strip()
        for dangerous in _DANGEROUS_COMMANDS:
            if cmd_lower.startswith(dangerous) or cmd_lower == dangerous.strip():
                return f"Blocked dangerous command: '{cmd}'. This operation requires direct console access."
    return None

# 初始化业务服务
automation_service = AutomationService(driver_type='netmiko') # 使用 Netmiko 驱动执行命令

@router.post("/execute")
async def execute_task(request: Request, payload: dict = Body(...)):
    device_id = payload.get('device_id')
    script_id = payload.get('script_id')
    command = payload.get('command')
    is_config_req = payload.get('isConfig')
    actor_username = payload.get('author') or payload.get('actor_username') or 'admin'
    actor_id = payload.get('actor_id')
    actor_role = payload.get('actor_role') or 'Administrator'

    conn = get_db_connection()
    try:
        device = conn.execute('SELECT * FROM devices WHERE id = ?', (device_id,)).fetchone()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        device_dict = dict(device)
        # Decrypt stored credentials before passing to driver
        device_dict['password'] = decrypt_credential(device_dict.get('password')) or ''
        final_command = command
        task_name = 'Direct Command'
        
        if script_id:
            # Try scripts table first
            script = conn.execute('SELECT * FROM scripts WHERE id = ?', (script_id,)).fetchone()
            if script:
                # If command is provided, it means the user edited the script content in the UI
                final_command = command if command else script['content']
                task_name = f"Script: {script['name']}"
            else:
                # Try templates table
                template = conn.execute('SELECT * FROM templates WHERE id = ?', (script_id,)).fetchone()
                if template:
                    final_command = command if command else template['content']
                    task_name = f"Template: {template['name']}"
        
        if not final_command:
            raise HTTPException(status_code=400, detail="No command or script provided")

        job_id = str(uuid.uuid4())
        conn.execute('INSERT INTO jobs (id, device_id, task_name, status, created_at) VALUES (?, ?, ?, ?, ?)',
                     (job_id, device_id, task_name, 'running', datetime.now().isoformat()))
        conn.commit()

        try:
            # 以命令内容为准判断是否走配置模式，不信任前端传入的 isConfig 标志。
            # show 类命令（dis/display/show/ping/tracert）绝不进入配置模式，
            # 防止前端将 CustomCommand 的 isConfig 错误设为 true。
            _cmd_lower = final_command.lower().lstrip()
            _show_prefixes = ('dis ', 'display ', 'show ', 'ping ', 'tracert ', 'traceroute ')
            if any(_cmd_lower.startswith(p) for p in _show_prefixes):
                is_config = False
            else:
                is_config = is_config_req if is_config_req is not None else \
                    any(kw in _cmd_lower for kw in ['conf t', 'configure terminal', 'system-view'])
            
            commands = [c.strip() for c in final_command.split('\n') if c.strip()]

            # ── Safety check: block dangerous/destructive commands ──
            safety_err = _check_command_safety(commands)
            if safety_err:
                conn.execute('UPDATE jobs SET status = ?, output = ? WHERE id = ?', ('blocked', safety_err, job_id))
                conn.commit()
                log_audit_event(
                    event_type='COMMAND_BLOCKED',
                    category='automation',
                    severity='critical',
                    status='blocked',
                    summary=f"Blocked dangerous command on {device_dict.get('hostname')}",
                    actor_username=actor_username,
                    actor_role=actor_role,
                    source_ip=request.client.host if request.client else None,
                    target_type='device',
                    target_id=device_id,
                    target_name=device_dict.get('hostname'),
                    device_id=device_id,
                    job_id=job_id,
                    details={'blocked_reason': safety_err, 'command_preview': '\n'.join(commands[:8])},
                )
                raise HTTPException(status_code=403, detail=safety_err)
            
            # 自动选择驱动：如果是测试 IP 则使用 Mock 驱动
            driver_type = 'mock' if device_dict.get('ip_address') in ['127.0.0.1', '0.0.0.0', 'localhost'] else 'netmiko'
            
            # 使用新架构的 Service 执行任务
            service = AutomationService(driver_type=driver_type)
            
            # 在线程池中执行同步驱动任务，避免阻塞 FastAPI 事件循环
            import time
            exec_start = time.time()
            
            def _execute():
                exec_begin = time.time()
                results = service.execute_commands(device_dict, commands, is_config=is_config)
                exec_elapsed = time.time() - exec_begin
                logger.info(f"Command execution took {exec_elapsed:.2f}s for device {device_dict.get('hostname')}")
                
                # 合并结果回显
                merge_start = time.time()
                output = "\n".join([r.output if r.success else f"Error: {r.error}" for r in results])
                merge_elapsed = time.time() - merge_start
                logger.info(f"Result merge took {merge_elapsed:.3f}s, output size: {len(output)} chars")
                
                return output

            result = await asyncio.get_event_loop().run_in_executor(None, _execute)
            total_elapsed = time.time() - exec_start
            logger.info(f"Total execution time: {total_elapsed:.2f}s")
            
            conn.execute('UPDATE jobs SET status = ?, output = ? WHERE id = ?', ('success', result, job_id))
            conn.commit()
            log_audit_event(
                event_type='DIRECT_EXECUTION',
                category='automation',
                severity='high' if is_config else 'medium',
                status='success',
                summary=f"Executed {task_name} on {device_dict.get('hostname')}",
                actor_id=str(actor_id) if actor_id is not None else None,
                actor_username=actor_username,
                actor_role=actor_role,
                source_ip=request.client.host if request.client else None,
                target_type='device',
                target_id=device_id,
                target_name=device_dict.get('hostname'),
                device_id=device_id,
                job_id=job_id,
                details={
                    'task_name': task_name,
                    'command_count': len(commands),
                    'is_config': is_config,
                    'script_id': script_id,
                    'command_preview': '\n'.join(commands[:8]),
                },
            )
            return {"status": "success", "jobId": job_id, "output": result}
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Job execution failed: {error_msg}", exc_info=True)
            conn.execute('UPDATE jobs SET status = ?, output = ? WHERE id = ?', ('failed', error_msg, job_id))
            conn.commit()
            log_audit_event(
                event_type='DIRECT_EXECUTION',
                category='automation',
                severity='high' if is_config_req else 'medium',
                status='failed',
                summary=f"Execution failed for {device_dict.get('hostname')}",
                actor_id=str(actor_id) if actor_id is not None else None,
                actor_username=actor_username,
                actor_role=actor_role,
                source_ip=request.client.host if request.client else None,
                target_type='device',
                target_id=device_id,
                target_name=device_dict.get('hostname'),
                device_id=device_id,
                job_id=job_id,
                details={'task_name': task_name, 'error': error_msg, 'script_id': script_id},
            )
            return JSONResponse(status_code=500, content={"status": "error", "error": error_msg, "jobId": job_id})
    finally:
        conn.close()

@router.post("/devices/connect")
async def test_connection(payload: dict = Body(...)):
    ip = payload.get('ip_address')
    if not ip:
        raise HTTPException(status_code=400, detail="IP address is required")
    
    try:
        # Run ping in a thread to avoid blocking
        def _ping():
            return ping(ip, timeout=2)
            
        delay = await asyncio.get_event_loop().run_in_executor(None, _ping)
        
        if delay is not None:
            return {
                "status": "success", 
                "message": f"Ping to {payload.get('hostname')} ({ip}) successful", 
                "output": f"Response time: {delay*1000:.2f}ms"
            }
        else:
            raise Exception(f"Ping to {ip} timed out")
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})

@router.get("/scripts")
def read_scripts():
    conn = get_db_connection()
    try:
        scripts = conn.execute('SELECT * FROM scripts').fetchall()
        return [dict(s) for s in scripts]
    finally:
        conn.close()

@router.post("/scripts")
def create_script(script: dict = Body(...)):
    conn = get_db_connection()
    script_id = script.get('id') or str(uuid.uuid4())
    try:
        conn.execute('INSERT INTO scripts (id, name, platform, description, content) VALUES (?, ?, ?, ?, ?)',
                     (script_id, script.get('name'), script.get('platform'), script.get('description'), script.get('content')))
        conn.commit()
        return {"success": True}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})
    finally:
        conn.close()
