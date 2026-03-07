# NetOps Automation 部署指南

## 项目概述

| 组件 | 技术栈 | 端口 |
|------|--------|------|
| 前端 | React 19 + TypeScript + Vite + TailwindCSS | 3000 (dev) |
| 后端 | Python FastAPI + Uvicorn | 8003 |
| 数据库 | SQLite (WAL mode) | - |
| SNMP | pysnmp 7.x | - |

## 项目结构

```
netops-automation/
├── backend/              # Python 后端
│   ├── main.py           # FastAPI 入口 + 状态监控
│   ├── database.py       # SQLite 数据库管理
│   ├── api/              # API 路由
│   ├── core/             # 配置与日志
│   ├── drivers/          # 设备驱动 (Netmiko/Scrapli)
│   ├── models/           # 数据模型
│   ├── schemas/          # Pydantic schemas
│   ├── services/         # SNMP 服务等
│   └── requirements.txt  # Python 依赖
├── src/                  # React 前端
│   ├── App.tsx           # 主应用组件
│   ├── main.tsx          # 入口
│   ├── i18n.tsx          # 国际化
│   └── components/       # UI 组件
├── data/                 # SQLite 数据库目录
├── backup/               # 配置备份目录
├── package.json          # Node.js 依赖与脚本
├── vite.config.ts        # Vite 配置
└── cleanup-ports.js      # 端口清理脚本 (跨平台)
```

---

## Windows 部署

### 前置条件

- **Node.js** ≥ 18（推荐通过 https://nodejs.org 安装 LTS 版本）
- **Python** ≥ 3.10（推荐通过 https://www.python.org 安装，安装时勾选 "Add to PATH"）
- **Git**（可选，用于克隆仓库）

### 安装步骤

```powershell
# 1. 克隆项目
git clone <repo-url> netops-automation
cd netops-automation

# 2. 创建 Python 虚拟环境
py -3 -m venv .venv

# 3. 激活虚拟环境
.venv\Scripts\activate

# 4. 安装 Python 依赖
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt

# 5. 安装 Node.js 依赖
npm install
```

### 启动开发环境

```powershell
# 一键启动（前端 + 后端）
npm run dev

# 或者分别启动
npm run dev:backend:win     # 仅后端
npm run dev:frontend        # 仅前端
```

### 生产构建与运行

```powershell
npm run start:win
# 或
npm run build              # 构建前端
.venv\Scripts\python.exe backend\main.py   # 启动后端（同时 serve 前端）
```

### Windows 特有注意事项

1. **防火墙**：首次运行时 Windows Defender 可能弹出网络访问提示，需要允许 Python 和 Node.js 的网络访问
2. **ping3 权限**：`ping3` 库在 Windows 上通常可直接使用，无需额外权限
3. **端口占用**：如遇端口被占用，运行 `npm run cleanup` 或手动查看：
   ```powershell
   netstat -ano | findstr :8003
   taskkill /PID <pid> /F
   ```
4. **PowerShell 执行策略**：如果 `.venv\Scripts\activate` 报错，先执行：
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

---

## Ubuntu 部署

### 前置条件

```bash
# 安装 Node.js (通过 nvm，推荐)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 20

# 安装 Python 和系统依赖
sudo apt update
sudo apt install python3 python3-venv python3-dev build-essential
```

### 安装步骤

```bash
# 1. 克隆项目
git clone <repo-url> netops-automation
cd netops-automation

# 2. 创建 Python 虚拟环境
python3 -m venv .venv

# 3. 激活虚拟环境
source .venv/bin/activate

# 4. 安装 Python 依赖
pip install -r backend/requirements.txt

# 5. 安装 Node.js 依赖
npm install
```

### 启动开发环境

```bash
# 一键启动（前端 + 后端）
npm run dev

# 或者分别启动
npm run dev:backend:linux   # 仅后端
npm run dev:frontend        # 仅前端
```

### 生产构建与运行

```bash
npm run start:linux
# 或
npm run build
.venv/bin/python backend/main.py
```

### Ubuntu 特有注意事项

1. **ping3 需要 RAW 权限**：Linux 上发送 ICMP 包需要特权，有两种方式：
   ```bash
   # 方式 A：给 Python 添加 CAP_NET_RAW 能力（推荐）
   sudo setcap cap_net_raw+ep $(readlink -f .venv/bin/python)

   # 方式 B：以 root 运行（不推荐）
   sudo .venv/bin/python backend/main.py
   ```
2. **防火墙**：Ubuntu 默认 UFW 可能阻止外部访问：
   ```bash
   sudo ufw allow 8003/tcp    # 后端 API
   sudo ufw allow 3000/tcp    # 前端开发服务器（仅开发时需要）
   ```
3. **端口占用**：查看和清理端口：
   ```bash
   lsof -i :8003
   kill -9 <pid>
   # 或直接
   npm run cleanup
   ```
4. **Vite watcher 限制**：如果 `npm run dev` 在 Ubuntu 上报 `ENOSPC: System limit for number of file watchers reached`，本项目已在 `vite.config.ts` 中忽略 `.venv/`、`backend/`、`backup/`、`data/` 等目录。拉取最新代码后重试；如果宿主机 watcher 上限仍然偏低，可额外执行：
   ```bash
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   echo fs.inotify.max_user_instances=1024 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```
5. **后台运行（生产）**：使用 systemd 服务：
   ```bash
   # 创建服务文件
   sudo tee /etc/systemd/system/netops.service > /dev/null <<EOF
   [Unit]
   Description=NetOps Automation Platform
   After=network.target

   [Service]
   Type=simple
   User=$USER
   WorkingDirectory=$(pwd)
   ExecStart=$(pwd)/.venv/bin/python backend/main.py
   Restart=always
   RestartSec=5
   Environment=NODE_ENV=production
   Environment=PYTHONPATH=backend
   AmbientCapabilities=CAP_NET_RAW

   [Install]
   WantedBy=multi-user.target
   EOF

   sudo systemctl daemon-reload
   sudo systemctl enable netops
   sudo systemctl start netops
   ```

---

## 通用说明

### npm 脚本一览

| 命令 | 说明 |
|------|------|
| `npm run dev` | 一键启动开发环境（自动检测平台） |
| `npm run dev:backend:win` | 仅启动后端（Windows） |
| `npm run dev:backend:linux` | 仅启动后端（Ubuntu/Linux） |
| `npm run dev:frontend` | 仅启动前端开发服务器 |
| `npm run build` | 构建前端生产版本到 `dist/` |
| `npm run start` | 构建 + 启动生产模式（自动检测平台） |
| `npm run cleanup` | 清理占用的 8003/3000 端口 |
| `npm run clean` | 删除 `dist/` 构建目录 |

### 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin | Administrator |

### 环境变量 (.env)

从 `.env.example` 复制并按需修改：
```bash
cp .env.example .env
```

监控与告警建议增加以下变量：
```env
# 高频原始接口遥测保留时长（小时）
TELEMETRY_RAW_RETENTION_HOURS=48

# 1分钟聚合遥测保留时长（天）
TELEMETRY_ROLLUP_RETENTION_DAYS=365

# 接口 DOWN 告警开关
ALERT_INTERFACE_DOWN_ENABLED=true

# 接口带宽利用率告警阈值（百分比）
ALERT_INTERFACE_UTIL_THRESHOLD=85

# 告警通知 Webhook（可填写企业微信机器人地址）
ALERT_NOTIFY_WEBHOOK_URL=
```

### 访问地址

- 开发模式：http://localhost:3000（Vite 代理 API 到 8003）
- 生产模式：http://localhost:8003（FastAPI 直接 serve 前端）

