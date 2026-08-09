"""Collect a source-backed visible-food eval dataset from Wikimedia Commons.

The seed list is hand-curated for coverage, while image URLs, source pages, and
license metadata are resolved from Commons at collection time.
"""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.parse
import urllib.request
from urllib.error import HTTPError
from dataclasses import dataclass
from pathlib import Path
from typing import Any


COMMONS_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "CaliFoodEvalDataset/1.0 (source-backed visible food evaluation)"


@dataclass(frozen=True)
class Seed:
    id: str
    query: str
    category: str
    expected: list[str]
    forbidden: list[str]
    notes: str


SEEDS: list[Seed] = [
    Seed("simple-apple", "red apple food photograph", "simple_food", ["apple"], ["banana", "granola"], "Single whole fruit."),
    Seed("simple-banana", "Banana-Single", "simple_food", ["banana"], ["granola", "strawberry"], "Single fruit where banana is truly visible."),
    Seed("simple-strawberries", "strawberries bowl photograph", "simple_food", ["strawberries"], ["banana", "granola"], "Red berries should not imply toppings."),
    Seed("simple-orange", "orange fruit slices photograph", "simple_food", ["orange"], ["banana", "granola"], "Citrus slices."),
    Seed("simple-avocado", "avocado halves photograph", "simple_food", ["avocado"], ["egg", "toast"], "Plain avocado without toast assumptions."),
    Seed("simple-fried-egg", "fried egg photograph", "simple_food", ["egg"], ["toast", "bacon"], "Simple cooked egg."),
    Seed("simple-boiled-eggs", "Eggs hard-boiled Massachusetts", "simple_food", ["egg"], ["mayonnaise", "toast"], "Eggs only."),
    Seed("simple-grilled-salmon", "grilled salmon fillet photograph", "simple_food", ["salmon"], ["rice", "potatoes"], "Protein-only or primary protein image."),
    Seed("simple-steak", "grilled steak photograph", "simple_food", ["steak"], ["potatoes", "butter"], "Meat should not imply sides."),
    Seed("simple-chicken-breast", "grilled chicken breast photograph", "simple_food", ["chicken"], ["rice", "broccoli"], "Chicken without assumed sides."),
    Seed("plate-chicken-rice-broccoli", "chicken rice broccoli plate photograph", "complex_meal", ["chicken", "rice", "broccoli"], ["granola", "banana"], "Classic mixed plate."),
    Seed("plate-salmon-asparagus", "salmon asparagus plate photograph", "complex_meal", ["salmon", "asparagus"], ["rice", "granola"], "Fish and vegetable plate."),
    Seed("plate-steak-potatoes", "steak potatoes plate photograph", "complex_meal", ["steak", "potatoes"], ["rice", "granola"], "Meat and potatoes."),
    Seed("plate-fish-and-chips", "fish and chips photograph", "complex_meal", ["fish", "fries"], ["rice", "salad"], "Fried fish with fries."),
    Seed("plate-sushi", "sushi platter photograph", "complex_meal", ["sushi", "rice", "fish"], ["granola", "banana"], "Sushi pieces with visible rice/fish."),
    Seed("salad-greek", "Greek salad photograph", "complex_meal", ["tomato", "cucumber", "feta"], ["chicken", "granola"], "Salad with visible vegetables and cheese."),
    Seed("salad-caesar", "Caesar salad photograph", "complex_meal", ["lettuce", "croutons"], ["strawberries", "banana"], "Leafy salad with croutons."),
    Seed("salad-caprese", "caprese salad photograph", "complex_meal", ["tomato", "mozzarella", "basil"], ["lettuce", "granola"], "Simple visible components."),
    Seed("salad-green", "lettuce salad photograph", "complex_meal", ["lettuce"], ["chicken", "cheese", "granola"], "Conservative leafy salad case."),
    Seed("salad-fruit", "fruit salad photograph", "complex_meal", ["fruit"], ["granola", "yogurt"], "Mixed fruit should not imply yogurt."),
    Seed("bowl-oatmeal-berries", "porridge with berries", "complex_meal", ["oatmeal", "berries"], ["banana", "granola"], "Bowl where oats are source-backed."),
    Seed("bowl-yogurt-berries", "yogurt berries bowl photograph", "complex_meal", ["yogurt", "berries"], ["granola", "banana"], "Tests not adding granola automatically."),
    Seed("bowl-rice", "rice bowl vegetables photograph", "complex_meal", ["rice", "vegetables"], ["granola", "banana"], "Savory bowl case."),
    Seed("bowl-burrito", "burrito bowl photograph", "complex_meal", ["rice", "beans"], ["granola", "banana"], "Savory multi-ingredient bowl."),
    Seed("soup-tomato", "tomato soup photograph", "complex_meal", ["tomato soup"], ["rice", "granola"], "Soup should remain soup."),
    Seed("soup-ramen", "ramen bowl photograph", "complex_meal", ["noodles", "broth"], ["granola", "banana"], "Noodle soup."),
    Seed("soup-pho", "pho soup photograph", "complex_meal", ["noodles", "broth"], ["granola", "banana"], "Another noodle soup style."),
    Seed("soup-lentil", "lentil soup photograph", "complex_meal", ["lentil soup"], ["rice", "granola"], "Thick legume soup."),
    Seed("soup-miso", "miso soup photograph", "complex_meal", ["miso soup"], ["rice", "granola"], "Clear soup with tofu/seaweed may be visible."),
    Seed("complex-hamburger", "NCI Visuals Food Hamburger", "complex_meal", ["hamburger"], ["fries", "cola"], "Sandwich without assumed sides."),
    Seed("complex-spaghetti", "spaghetti tomato sauce photograph", "complex_meal", ["spaghetti"], ["meatballs", "cheese"], "Pasta without automatic extras."),
    Seed("complex-taco", "taco photograph", "complex_meal", ["taco"], ["rice", "beans"], "Single handheld food without assumed sides."),
    Seed("breakfast-croissant-coffee", "croissant coffee photograph", "complex_meal", ["croissant", "coffee"], ["egg", "granola"], "Breakfast pairing."),
    Seed("breakfast-pancakes-blueberries", "pancakes blueberries photograph", "complex_meal", ["pancakes", "blueberries"], ["banana", "granola"], "Pancake topping case."),
    Seed("breakfast-waffles-strawberries", "waffles strawberries photograph", "complex_meal", ["waffles", "strawberries"], ["banana", "granola"], "Waffle topping case."),
    Seed("breakfast-avocado-toast", "avocado toast photograph", "complex_meal", ["avocado", "toast"], ["egg", "bacon"], "Toast should not imply egg."),
    Seed("breakfast-cereal-milk", "Cereal with Milk Unsplash", "complex_meal", ["cereal", "milk"], ["banana", "strawberries"], "Cereal bowl with milk."),
    Seed("drink-black-coffee", "black coffee cup photograph", "beverage", ["coffee"], ["milk", "sugar"], "Plain beverage case."),
    Seed("drink-orange-juice", "Orange juice 1 edit1", "beverage", ["orange juice"], ["milk", "banana"], "Juice case."),
    Seed("drink-smoothie", "Glass of strawberry smoothie", "beverage", ["smoothie"], ["granola", "oats"], "Blended drink should not imply toppings."),
    Seed("drink-beer", "beer glass photograph", "beverage", ["beer"], ["lemon", "pretzel"], "Alcoholic beverage."),
    Seed("drink-cola", "cola glass photograph", "beverage", ["cola"], ["ice cream", "lemon"], "Soda beverage."),
    Seed("dessert-ice-cream", "ice cream bowl photograph", "complex_meal", ["ice cream"], ["granola", "banana"], "Dessert bowl, avoid toppings unless visible."),
    Seed("dessert-cake-slice", "cake slice photograph", "complex_meal", ["cake"], ["ice cream", "berries"], "Cake alone."),
    Seed("dessert-cheesecake", "cheesecake slice photograph", "complex_meal", ["cheesecake"], ["strawberries", "cream"], "Cheesecake without automatic garnish."),
    Seed("dessert-apple-pie", "apple pie slice photograph", "complex_meal", ["apple pie"], ["ice cream", "cream"], "Pie without assumed side."),
    Seed("dessert-donut", "doughnut photograph", "simple_food", ["doughnut"], ["coffee", "cream"], "Single pastry."),
    Seed("complex-pizza-slice", "pizza slice photograph", "complex_meal", ["pizza"], ["salad", "fries"], "Single mixed-food item without assumed sides."),
    Seed("packaged-coca-cola-can", "Coca-Cola can photograph", "packaged_product", ["Coca-Cola"], ["coffee", "milk"], "Packaged beverage recognition."),
    Seed("packaged-yogurt-cup", "Llaeth y Llan Village Dairy yogurt", "packaged_product", ["yogurt"], ["granola", "banana"], "Packaged dairy without toppings."),
    Seed("packaged-chocolate-bar", "chocolate bar package photograph", "packaged_product", ["chocolate"], ["nuts", "caramel"], "Packaged candy."),
    Seed("packaged-potato-chips", "potato chips bag photograph", "packaged_product", ["potato chips"], ["salsa", "cheese"], "Packaged snack."),
    Seed("nutrition-label", "nutrition facts label photograph", "nutrition_label", ["nutrition facts label"], ["banana", "granola"], "Label/OCR path smoke case."),
]


def _tokens(text: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]+", text.lower()) if len(token) > 2}


def _candidate_score(seed: Seed, page: dict[str, Any]) -> int:
    title = page.get("title", "")
    lowered_title = title.lower()
    expected_tokens = set().union(*(_tokens(name) for name in seed.expected))
    query_tokens = _tokens(seed.query)
    title_tokens = _tokens(title)
    score = 0
    score += 6 * len(expected_tokens & title_tokens)
    score += 2 * len(query_tokens & title_tokens)
    if any(name.lower() in lowered_title for name in seed.expected):
        score += 10
    if "file:" in lowered_title:
        score += 1
    if any(extension in lowered_title for extension in [".pdf", ".svg", ".ogv", ".webm", ".djvu"]):
        score -= 100
    return score


def commons_query(seed: Seed, retries: int) -> dict[str, Any]:
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": seed.query,
        "gsrnamespace": "6",
        "gsrlimit": "10",
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
        "format": "json",
        "formatversion": "2",
    }
    url = f"{COMMONS_API}?{urllib.parse.urlencode(params)}"
    payload: dict[str, Any] | None = None
    for attempt in range(retries + 1):
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                payload = json.loads(response.read().decode("utf-8"))
            break
        except HTTPError as exc:
            if exc.code != 429 or attempt >= retries:
                raise
            time.sleep(10 * (attempt + 1))

    if payload is None:
        raise RuntimeError(f"No Commons response for {seed.id}: {seed.query}")

    pages = payload.get("query", {}).get("pages", [])
    if not pages:
        raise RuntimeError(f"No Commons result for {seed.id}: {seed.query}")

    ranked_pages = sorted(pages, key=lambda page: _candidate_score(seed, page), reverse=True)
    page = ranked_pages[0]
    if _candidate_score(seed, page) < 1:
        raise RuntimeError(f"No relevant Commons image for {seed.id}: {seed.query}")
    image_info = page.get("imageinfo", [{}])[0]
    metadata = image_info.get("extmetadata", {})

    def meta(name: str) -> str | None:
        value = metadata.get(name, {}).get("value")
        return value if isinstance(value, str) and value else None

    title = page["title"]
    source_url = image_info.get("descriptionurl") or (
        "https://commons.wikimedia.org/wiki/"
        + urllib.parse.quote(title.replace(" ", "_"), safe=":/_")
    )

    return {
        "id": seed.id,
        "source": "wikimedia_commons",
        "source_url": source_url,
        "image_url": image_info["url"],
        "license": meta("LicenseShortName") or meta("UsageTerms") or "unknown",
        "attribution": meta("Artist") or meta("Credit") or "Wikimedia Commons contributor",
        "source_title": title,
        "query": seed.query,
        "category": seed.category,
        "expected_visible_ingredients": [
            {
                "name": name,
                "required": True,
                "source_backing": "seeded from source search query and Commons image result",
            }
            for name in seed.expected
        ],
        "ambiguous_visible_items": [],
        "forbidden_ingredients": seed.forbidden,
        "notes": seed.notes,
    }


def collect(output: Path, delay_seconds: float, retries: int, resume: bool) -> None:
    existing: dict[str, Any] = {}
    if resume and output.exists():
        current = json.loads(output.read_text())
        existing = {example["id"]: example for example in current.get("examples", [])}

    examples = list(existing.values())
    failures = []
    for seed in SEEDS:
        if seed.id in existing:
            print(f"skip {seed.id}", flush=True)
            continue
        try:
            examples.append(commons_query(seed, retries))
            print(f"ok {seed.id}", flush=True)
        except Exception as exc:
            failures.append({"id": seed.id, "query": seed.query, "error": str(exc)})
            print(f"fail {seed.id}: {exc}", flush=True)
        time.sleep(delay_seconds)

    dataset = {
        "name": "source_backed_visible_food_eval",
        "version": 1,
        "description": (
            "Public-source image examples for testing visible-food recognition. "
            "Expected labels are intentionally conservative; source URLs and direct image URLs "
            "come from Wikimedia Commons."
        ),
        "source_policy": "Use for evaluation only; respect each image's linked license and attribution.",
        "examples": examples,
        "collection_failures": failures,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(dataset, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(examples)} examples to {output}", flush=True)
    if failures:
        print(f"{len(failures)} failures recorded", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "evals"
        / "source_backed_visible_food_dataset.json",
    )
    parser.add_argument("--delay-seconds", type=float, default=0.1)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    collect(args.output, args.delay_seconds, args.retries, args.resume)


if __name__ == "__main__":
    main()
