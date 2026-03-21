from __future__ import annotations

import json
from pathlib import Path

from cooking_agent.models import Recipe, SearchResult


class RecipeStore:
    def __init__(self, data_path: Path) -> None:
        self._data_path = data_path
        self._recipes = self._load()

    def _load(self) -> list[Recipe]:
        raw_items = json.loads(self._data_path.read_text(encoding="utf-8"))
        return [Recipe(**item) for item in raw_items]

    def get(self, recipe_id: str) -> Recipe | None:
        recipe_id = recipe_id.strip().lower()
        for recipe in self._recipes:
            if recipe.id.lower() == recipe_id:
                return recipe
        return None

    def search(self, query: str, limit: int = 5) -> list[SearchResult]:
        query_terms = [term for term in query.strip().lower().split() if term]
        if not query_terms:
            return []

        scored_results: list[SearchResult] = []
        for recipe in self._recipes:
            haystack = " ".join(
                [
                    recipe.title,
                    recipe.summary,
                    recipe.cuisine,
                    *recipe.tags,
                    *recipe.ingredients,
                    *recipe.steps,
                ]
            ).lower()
            score = sum(1 for term in query_terms if term in haystack)
            if score:
                scored_results.append(SearchResult(recipe=recipe, score=score))

        scored_results.sort(key=lambda item: (-item.score, item.recipe.title))
        return scored_results[:limit]

    def all_recipe_ids(self) -> list[str]:
        return [recipe.id for recipe in self._recipes]
