from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class Recipe:
    id: str
    title: str
    summary: str
    cuisine: str
    tags: list[str]
    ingredients: list[str]
    steps: list[str]


@dataclass(slots=True)
class SearchResult:
    recipe: Recipe
    score: int
