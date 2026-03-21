from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
from openai import AsyncOpenAI


PROJECT_ROOT = Path(__file__).resolve().parents[2]


class ConfigurationError(RuntimeError):
    pass


@dataclass(slots=True)
class AppConfig:
    model_provider: str
    github_token: str | None
    github_model: str
    openai_api_key: str | None
    openai_base_url: str
    openai_model: str

    @classmethod
    def load(cls) -> "AppConfig":
        load_dotenv(PROJECT_ROOT / ".env")
        return cls(
            model_provider=os.getenv("MODEL_PROVIDER", "github").strip().lower(),
            github_token=os.getenv("GITHUB_TOKEN"),
            github_model=os.getenv("GITHUB_MODEL", "openai/gpt-4.1-mini"),
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            openai_base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
            openai_model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        )

    def create_openai_client(self) -> tuple[AsyncOpenAI, str]:
        if self.model_provider == "github":
            if not self.github_token:
                raise ConfigurationError("缺少 GITHUB_TOKEN。请复制 .env.example 为 .env 后补齐 GitHub Token。")
            return (
                AsyncOpenAI(
                    base_url="https://models.github.ai/inference",
                    api_key=self.github_token,
                ),
                self.github_model,
            )

        if self.model_provider == "openai":
            if not self.openai_api_key:
                raise ConfigurationError("缺少 OPENAI_API_KEY。请在 .env 中补齐 OpenAI 兼容接口配置。")
            return (
                AsyncOpenAI(
                    base_url=self.openai_base_url,
                    api_key=self.openai_api_key,
                ),
                self.openai_model,
            )

        raise ConfigurationError(
            f"不支持的 MODEL_PROVIDER: {self.model_provider}。可选值为 github 或 openai。"
        )
