from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from agent_framework import Agent
from agent_framework.exceptions import ChatClientException
from agent_framework.openai import OpenAIChatClient

from cooking_agent.config import AppConfig, ConfigurationError
from cooking_agent.recipe_store import RecipeStore
from cooking_agent.tools import build_tools


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_FILE = PROJECT_ROOT / "data" / "recipes.json"
SYSTEM_PROMPT = """
You are PantryPilot, a cooking AI assistant.

Behavior rules:
- Always answer in the same language as the user.
- For recipe discovery, use the available tools before recommending recipes.
- Prefer concise, actionable cooking advice.
- When extracting ingredients, return two sections:
  1. A short natural-language summary.
  2. A JSON array named ingredients.
- In the ingredients JSON array, each item must contain:
  - name
  - quantity
  - unit
  - note
- Use null for unknown quantity or unit.
- If the user asks for a recipe by id, call the detailed recipe tool.
- If a tool returns no results, say that clearly and suggest a refined query.
""".strip()


class CookingAgentApp:
    def __init__(self) -> None:
        self.config = AppConfig.load()
        self.store = RecipeStore(DATA_FILE)
        async_client, model_id = self.config.create_openai_client()
        self.agent = Agent(
            client=OpenAIChatClient(async_client=async_client, model_id=model_id),
            name="PantryPilot",
            instructions=SYSTEM_PROMPT,
            tools=build_tools(self.store),
        )
        self._session = None
        self._agent_context = None

    async def __aenter__(self) -> "CookingAgentApp":
        self._agent_context = self.agent
        await self._agent_context.__aenter__()
        self._session = self.agent.create_session()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if self._agent_context is not None:
            await self._agent_context.__aexit__(exc_type, exc, tb)

    async def ask(self, prompt: str) -> str:
        print("\nAgent: ", end="", flush=True)
        stream = self.agent.run(prompt, session=self._session, stream=True)
        chunks: list[str] = []
        async for chunk in stream:
            if chunk.text:
                print(chunk.text, end="", flush=True)
                chunks.append(chunk.text)
        print("\n")
        await stream.get_final_response()
        return "".join(chunks).strip()

    def reset_session(self) -> None:
        self._session = self.agent.create_session()


def build_prompt_for_search(query: str) -> str:
    return (
        "请根据用户的偏好搜索可用菜谱，并给出 2 到 4 个最匹配的结果。"
        "先调用搜索工具，再总结每道菜适合的场景、核心食材和预计难度。\n\n"
        f"用户查询: {query}"
    )


def build_prompt_for_extraction(text: str) -> str:
    return (
        "请从下面这段文字里抽取做菜相关的配料信息。"
        "输出一个简短总结，并附带名为 ingredients 的 JSON 数组。\n\n"
        f"原始文本: {text}"
    )


def build_prompt_for_recipe(recipe_id: str) -> str:
    return (
        "请读取指定菜谱详情并做简明说明，包括菜谱简介、主要食材和步骤摘要。\n\n"
        f"菜谱ID: {recipe_id}"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Interactive cooking AI agent")
    parser.add_argument("--once", help="单次向代理提问")
    parser.add_argument("--search", help="执行一次菜谱搜索")
    parser.add_argument("--extract", help="执行一次配料抽取")
    parser.add_argument("--recipe", help="按菜谱 ID 查看详细菜谱")
    return parser.parse_args()


def print_welcome() -> None:
    print("PantryPilot 已启动。")
    print("输入 /help 查看命令，输入 /quit 退出。")


def print_help() -> None:
    print("可用命令:")
    print("  /search <关键词>   搜索菜谱")
    print("  /extract <文本>    抽取配料")
    print("  /recipe <ID>       查看菜谱详情")
    print("  /reset             重置当前会话")
    print("  /quit              退出程序")


async def run_once(args: argparse.Namespace) -> int:
    if not any([args.once, args.search, args.extract, args.recipe]):
        return 0

    async with CookingAgentApp() as app:
        if args.once:
            await app.ask(args.once)
        elif args.search:
            await app.ask(build_prompt_for_search(args.search))
        elif args.extract:
            await app.ask(build_prompt_for_extraction(args.extract))
        elif args.recipe:
            await app.ask(build_prompt_for_recipe(args.recipe))
    return 0


async def run_interactive() -> int:
    async with CookingAgentApp() as app:
        print_welcome()
        while True:
            user_input = input("You: ").strip()
            if not user_input:
                continue
            if user_input == "/quit":
                print("再见。")
                return 0
            if user_input == "/help":
                print_help()
                continue
            if user_input == "/reset":
                app.reset_session()
                print("会话已重置。")
                continue
            if user_input.startswith("/search "):
                await app.ask(build_prompt_for_search(user_input[8:].strip()))
                continue
            if user_input.startswith("/extract "):
                await app.ask(build_prompt_for_extraction(user_input[9:].strip()))
                continue
            if user_input.startswith("/recipe "):
                await app.ask(build_prompt_for_recipe(user_input[8:].strip()))
                continue
            await app.ask(user_input)


async def async_main() -> int:
    args = parse_args()
    if any([args.once, args.search, args.extract, args.recipe]):
        return await run_once(args)
    return await run_interactive()


def main() -> int:
    try:
        return asyncio.run(async_main())
    except KeyboardInterrupt:
        print("\n已中断。")
        return 130
    except ConfigurationError as exc:
        print(f"配置错误: {exc}")
        return 2
    except ChatClientException as exc:
        message = str(exc)
        if "Unauthorized" in message:
            print("模型认证失败: 请检查 .env 中的令牌、模型名称和提供方配置。")
            return 3
        if "timed out" in message.lower() or "timeout" in message.lower():
            print("模型请求超时: 请检查网络连接或稍后重试。")
            return 4
        print(f"模型调用失败: {message}")
        return 5
