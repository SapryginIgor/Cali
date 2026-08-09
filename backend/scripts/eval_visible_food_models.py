"""Compare vision models on visible-only food ingredient extraction.

Usage:
    uv run python scripts/eval_visible_food_models.py --image /path/to/photo.jpg

The script intentionally asks only for visible ingredients. Nutrition/macros are
excluded so the first-stage vision task is measured separately from estimation.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import AsyncOpenAI


DEFAULT_MODELS = [
    "gpt-4.1",
    "gpt-5.6-luna",
    "gpt-5.6-terra",
    "gpt-5.6-sol",
]

FORBIDDEN_DEFAULTS = [
    "banana",
    "granola",
    "muesli",
    "nut",
    "nuts",
    "almond",
    "seed",
    "seeds",
    "honey",
    "syrup",
]

VISIBLE_INGREDIENT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "logName": {"type": "string"},
        "visibleIngredients": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string"},
                    "evidence": {"type": "string"},
                    "certainty": {"type": "number", "minimum": 0, "maximum": 1},
                },
                "required": ["name", "evidence", "certainty"],
            },
        },
        "uncertainVisibleItems": {"type": "array", "items": {"type": "string"}},
        "rejectedCommonButUnseenItems": {"type": "array", "items": {"type": "string"}},
        "notes": {"type": "string"},
    },
    "required": [
        "logName",
        "visibleIngredients",
        "uncertainVisibleItems",
        "rejectedCommonButUnseenItems",
        "notes",
    ],
}


def _image_data_url(path: Path) -> str:
    suffix = path.suffix.lower()
    mime = "image/png" if suffix == ".png" else "image/jpeg"
    encoded = base64.b64encode(path.read_bytes()).decode("utf-8")
    return f"data:{mime};base64,{encoded}"


def _extract_names(parsed: dict[str, Any]) -> list[str]:
    ingredients = parsed.get("visibleIngredients", [])
    if not isinstance(ingredients, list):
        return []
    names: list[str] = []
    for item in ingredients:
        if isinstance(item, dict) and isinstance(item.get("name"), str):
            names.append(item["name"].strip())
    return [name for name in names if name]


def _forbidden_hits(names: list[str], forbidden: list[str]) -> list[str]:
    joined_names = " | ".join(names).lower()
    return [term for term in forbidden if term.lower() in joined_names]


async def evaluate_model(
    client: AsyncOpenAI,
    model: str,
    image_url: str,
    forbidden: list[str],
) -> dict[str, Any]:
    prompt = (
        "Identify ONLY food ingredients that are directly visible in this image. "
        "Do not estimate nutrition. Do not infer recipe ingredients. Do not add common toppings "
        "or likely ingredients unless you can point to visible image evidence. In particular, "
        "banana, granola, muesli, nuts, seeds, honey, and syrup must be rejected unless they are "
        "clearly visible. Return JSON only."
    )

    started = time.monotonic()
    try:
        response = await client.responses.create(
            model=model,
            input=[
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": prompt},
                        {"type": "input_image", "image_url": image_url, "detail": "high"},
                    ],
                }
            ],
            max_output_tokens=900,
            text={
                "format": {
                    "type": "json_schema",
                    "name": "visible_food_eval",
                    "schema": VISIBLE_INGREDIENT_SCHEMA,
                    "strict": True,
                }
            },
        )
        elapsed_ms = round((time.monotonic() - started) * 1000)
        parsed = json.loads(response.output_text)
        names = _extract_names(parsed)
        hits = _forbidden_hits(names, forbidden)
        return {
            "model": model,
            "ok": True,
            "elapsedMs": elapsed_ms,
            "forbiddenHits": hits,
            "visibleIngredients": names,
            "raw": parsed,
        }
    except Exception as exc:
        elapsed_ms = round((time.monotonic() - started) * 1000)
        return {
            "model": model,
            "ok": False,
            "elapsedMs": elapsed_ms,
            "error": f"{type(exc).__name__}: {exc}",
        }


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, type=Path)
    parser.add_argument("--models", nargs="*", default=DEFAULT_MODELS)
    parser.add_argument("--forbidden", nargs="*", default=FORBIDDEN_DEFAULTS)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")

    if not os.getenv("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is not configured")
    if not args.image.exists():
        raise SystemExit(f"Image not found: {args.image}")

    client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    image_url = _image_data_url(args.image)

    results = []
    for model in args.models:
        print(f"Evaluating {model}...")
        results.append(await evaluate_model(client, model, image_url, args.forbidden))

    report = {
        "image": str(args.image),
        "forbidden": args.forbidden,
        "results": results,
    }

    print(json.dumps(report, indent=2, ensure_ascii=False))
    if args.output:
        args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    asyncio.run(main())
