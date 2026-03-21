#!/usr/bin/env node

/**
 * 清理占用的端口（跨平台支持 Windows / Linux / macOS）
 * 在启动开发环境前运行此脚本来清理 8003 和 4300 端口
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);
const isWindows = os.platform() === 'win32';

async function killProcessOnPort(port) {
  try {
    if (isWindows) {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      if (stdout) {
        const lines = stdout.split('\n').filter(line => line.trim());
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== 'PID' && !isNaN(pid) && parseInt(pid) > 0) {
            try {
              await execAsync(`taskkill /PID ${pid} /F`);
              console.log(`✓ Killed process ${pid} on port ${port}`);
            } catch (err) { /* already dead */ }
          }
        }
      }
    } else {
      // Linux / macOS: 使用 lsof + kill
      const { stdout } = await execAsync(`lsof -ti :${port}`);
      if (stdout) {
        const pids = stdout.trim().split('\n').filter(Boolean);
        for (const pid of pids) {
          try {
            await execAsync(`kill -9 ${pid}`);
            console.log(`✓ Killed process ${pid} on port ${port}`);
          } catch (err) { /* already dead */ }
        }
      }
    }
  } catch (err) {
    // Port is free
  }
}

async function main() {
  console.log('Cleaning up ports 8003 and 4300...');
  
  await killProcessOnPort(8003);
  await killProcessOnPort(4300);
  
  // Wait for ports to be released
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('✓ Port cleanup complete');
}

main().catch(err => {
  console.error('Error cleaning ports:', err.message);
  process.exit(1);
});
