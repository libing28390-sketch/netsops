from __future__ import annotations

import json
from typing import Annotated

from cooking_agent.recipe_store import RecipeStore


def build_tools(store: RecipeStore) -> list[object]:
    def search_recipes(
        query: Annotated[str, "用户给出的菜谱搜索关键词，例如 chicken dinner 或 番茄 鸡蛋 快手菜。"],
        limit: Annotated[int, "最多返回多少条菜谱。"] = 5,
    ) -> str:
        results = store.search(query=query, limit=limit)
        payload = [
            {
                "id": item.recipe.id,
                "title": item.recipe.title,
                "summary": item.recipe.summary,
                "cuisine": item.recipe.cuisine,
                "tags": item.recipe.tags,
                "ingredients": item.recipe.ingredients,
                "score": item.score,
            }
            for item in results
        ]
        return json.dumps(payload, ensure_ascii=False, indent=2)

    def get_recipe_details(
        recipe_id: Annotated[str, "菜谱 ID，例如 tomato-egg-stir-fry。"],
    ) -> str:
        recipe = store.get(recipe_id)
        if recipe is None:
            return json.dumps(
                {
                    "error": f"Recipe '{recipe_id}' not found.",
                    "available_ids": store.all_recipe_ids(),
                },
                ensure_ascii=False,
                indent=2,
            )

        return json.dumps(
            {
                "id": recipe.id,
                "title": recipe.title,
                "summary": recipe.summary,
                "cuisine": recipe.cuisine,
                "tags": recipe.tags,
                "ingredients": recipe.ingredients,
                "steps": recipe.steps,
            },
            ensure_ascii=False,
            indent=2,
        )

    return [search_recipes, get_recipe_details]
