# Cooking AI Agent

一个独立的 Python 控制台 AI 应用，使用 Microsoft Agent Framework 构建，支持两类核心能力：

- 菜谱搜索
- 配料抽取

## 功能说明

- 交互式控制台会话，保留上下文
- 使用本地菜谱库做检索，保证项目开箱即用
- 使用大语言模型理解用户意图，并调用检索工具组织结果
- 支持从自然语言描述中抽取食材、数量、单位和备注
- 支持 GitHub Models，也支持标准 OpenAI 兼容接口

## 推荐模型

当前工作区未检测到可直接使用的 Foundry 项目，因此默认推荐：

- GitHub Models: `openai/gpt-4.1-mini`

原因：

- 上手成本低，只需要 GitHub Token
- 对工具调用、指令遵循、结构化抽取足够稳定
- 适合当前这个单代理控制台应用

如果后续要切到生产环境，可改用 Foundry 或其他 OpenAI 兼容端点。

## 环境准备

建议在子项目目录内创建独立虚拟环境。

1. 复制环境变量模板

```powershell
Copy-Item .env.example .env
```

2. 按需填写：

- 使用 GitHub Models 时：
  - `MODEL_PROVIDER=github`
  - `GITHUB_TOKEN=<your-token>`
  - `GITHUB_MODEL=openai/gpt-4.1-mini`
- 使用 OpenAI 兼容接口时：
  - `MODEL_PROVIDER=openai`
  - `OPENAI_API_KEY=<your-key>`
  - `OPENAI_BASE_URL=<your-endpoint>`
  - `OPENAI_MODEL=<your-model>`

3. 安装依赖

```powershell
pip install -r requirements.txt
```

## 运行方式

进入交互模式：

```powershell
python main.py
```

单次提问：

```powershell
python main.py --once "推荐适合工作日晚餐的鸡肉食谱"
```

单次菜谱搜索：

```powershell
python main.py --search "番茄 鸡蛋 快手菜"
```

单次配料抽取：

```powershell
python main.py --extract "晚上做番茄炒蛋，需要3个鸡蛋、2个番茄、少许盐和1汤匙油。"
```

## 交互命令

- `/help` 查看帮助
- `/search 关键词` 搜索菜谱
- `/extract 文本` 抽取配料
- `/recipe 菜谱ID` 查看指定菜谱细节
- `/reset` 清空当前会话上下文
- `/quit` 退出程序

## 调试

本项目附带 VS Code 调试配置，可直接调试 CLI 入口。

- 启动配置: `.vscode/launch.json`
- 任务配置: `.vscode/tasks.json`

## 目录结构

```text
ai-cooking-agent/
  data/recipes.json
  src/cooking_agent/
    agent_app.py
    config.py
    models.py
    recipe_store.py
    tools.py
  .env.example
  main.py
  requirements.txt
```

## 说明

- Agent Framework 当前依赖预览版，已在 `requirements.txt` 中固定版本 `1.0.0rc3`，避免后续接口重命名带来的破坏性变化。
- 本项目默认不依赖外部数据库。
- 菜谱检索数据来自本地 JSON 文件，便于你后续扩展成数据库、向量检索或 RAG。
