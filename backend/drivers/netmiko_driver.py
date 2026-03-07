import time
from typing import List, Dict, Any
try:
    from netmiko import ConnectHandler, NetmikoTimeoutException, NetmikoAuthenticationException
    HAS_NETMIKO = True
except ImportError:
    HAS_NETMIKO = False
from .base import BaseDriver, CommandResult

class NetmikoDriver(BaseDriver):
    """基于 Netmiko 的驱动实现"""
    
    def __init__(self, device_info: Dict[str, Any]):
        super().__init__(device_info)
        self.conn = None
        # 映射平台
        self.device_type = self._map_platform(self.platform)

    def _map_platform(self, platform: str) -> str:
        mapping = {
            'cisco_ios': 'cisco_ios',
            'huawei_vrp': 'huawei',
            'h3c_comware': 'hp_comware',
            'juniper_junos': 'juniper_junos',
            'arista_eos': 'arista_eos'
        }
        return mapping.get(platform, 'cisco_ios')

    def connect(self):
        import logging
        logger = logging.getLogger(__name__)
        
        device_params = {
            'device_type': self.device_type,
            'host': self.host,
            'username': self.username,
            'password': self.password,
            'port': self.port,
            'timeout': 5,               # 连接超时 5 秒
            'session_timeout': 10,      # 会话超时 10 秒
            'global_delay_factor': 0.1, # 全局延迟因子（平衡稳定性和速度）
            'fast_cli': True,           # 启用快速CLI模式（关键优化）
            'blocking_timeout': 10,     # 阻塞超时 10 秒    
        }
        try:
            logger.debug(f"Connecting to {self.host}:{self.port} with device_type={self.device_type}")
            self.conn = ConnectHandler(**device_params)
            logger.info(f"Successfully connected to {self.host} (device_type: {self.device_type})")
        except (NetmikoTimeoutException, NetmikoAuthenticationException) as e:
            logger.error(f"Netmiko connection failed to {self.host}: {str(e)}", exc_info=True)
            raise Exception(f"Netmiko connection failed: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error connecting to {self.host}: {str(e)}", exc_info=True)
            raise Exception(f"Connection failed: {str(e)}")

    def disconnect(self):
        import logging
        logger = logging.getLogger(__name__)
        if self.conn:
            try:
                disconnect_start = time.time()
                # Disable sending 'exit' commands and close immediately
                if hasattr(self.conn.session_log, 'close'):
                    self.conn.session_log.close()
                # Close the underlying SSH transport without sending logout
                if hasattr(self.conn, 'remote_conn') and self.conn.remote_conn:
                    try:
                        self.conn.remote_conn.close()
                    except:
                        pass
                # Clean up the connection object reference
                self.conn = None
                disconnect_elapsed = time.time() - disconnect_start
                logger.debug(f"Fast disconnect completed in {disconnect_elapsed:.3f}s")
            except Exception as e:
                logger.debug(f"Disconnect error (non-critical): {str(e)}")

    def send_command(self, command: str) -> CommandResult:
        import logging
        logger = logging.getLogger(__name__)
        start_time = time.time()
        try:
            logger.debug(f"[send_command START] {self.host} | cmd: {command[:50]}")
            
            # send_command 基于提示符检测返回，fast_cli=True 已使延迟最小化。
            # cmd_verify=False 跳过命令回显确认，read_timeout 给设备足够响应时间。
            output = self.conn.send_command(
                command,
                cmd_verify=False,
                strip_prompt=True,
                strip_command=True,
                read_timeout=10
            )
            
            elapsed = time.time() - start_time
            logger.info(f"[send_command END] {self.host} | cmd: {command[:50]} | time: {elapsed:.2f}s | output: {len(output)} chars")
            
            return CommandResult(
                success=True,
                output=output,
                hostname=self.device_info.get('hostname', self.host),
                command=command,
                execution_time=elapsed
            )
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"[send_command ERROR] {self.host} | cmd: {command[:50]} | time: {elapsed:.2f}s | error: {str(e)}")
            return CommandResult(
                success=False,
                output="",
                error=str(e),
                hostname=self.device_info.get('hostname', self.host),
                command=command,
                execution_time=elapsed
            )

    def send_config(self, configs: List[str]) -> CommandResult:
        import logging
        logger = logging.getLogger(__name__)
        start_time = time.time()
        try:
            logger.debug(f"Sending config to {self.host}: {len(configs)} commands")
            # send_config_set 配合 fast_cli=True 已足够快（LAN 下每条命令 <100ms）。
            # cmd_verify=False 跳过每条命令的回显确认，是最主要的加速手段。
            # read_timeout 按命令数动态设置，保证复杂命令有足够时间响应。
            per_cmd_timeout = max(5, len(configs) * 2)
            output = self.conn.send_config_set(
                configs,
                exit_config_mode=True,
                cmd_verify=False,
                read_timeout=per_cmd_timeout
            )
            elapsed = time.time() - start_time
            logger.debug(f"Config completed in {elapsed:.2f}s on {self.host}")
            return CommandResult(
                success=True,
                output=output,
                hostname=self.device_info.get('hostname', self.host),
                command="\n".join(configs),
                execution_time=elapsed
            )
        except Exception as e:
            elapsed = time.time() - start_time
            logger.warning(f"Config failed after {elapsed:.2f}s on {self.host}: {str(e)}")
            return CommandResult(
                success=False,
                output="",
                error=str(e),
                hostname=self.device_info.get('hostname', self.host),
                command="\n".join(configs),
                execution_time=elapsed
            )
