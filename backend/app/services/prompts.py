"""
Prompt templates for the classify-then-analyze food recognition pipeline.

Each food category has a tailored prompt that maximises accuracy for that
input type while sharing a common JSON output schema.
"""

from typing import Optional

CLASSIFICATION_PROMPT = (
    "You are a food-image triage system. Look at the image (and optional text) "
    "and classify it into exactly ONE category.\n\n"
    "Categories:\n"
    '- "nutrition_label" — a visible nutrition facts panel or ingredient list is legible\n'
    '- "packaged_product" — branded/commercial packaging is visible but no readable nutrition label\n'
    '- "simple_food" — a single clearly identifiable food item (e.g. an apple, a boiled egg)\n'
    '- "complex_meal" — multiple food components or a composed dish\n'
    '- "beverage" — a drink in a cup, glass, or bottle\n'
    '- "text_only" — no image provided, only a text description\n\n'
    "Return ONLY a JSON object with this shape:\n"
    '{ "category": string, "hints": { "brand"?: string, "productName"?: string, '
    '"itemCount"?: number, "hasLabel"?: boolean } }\n\n'
    "Rules:\n"
    "- Pick the single best-fit category.\n"
    "- If multiple visible items are present, set `hints.itemCount` to an approximate count.\n"
    "- For mixed packaged-product scenes (e.g. cartons + bottle), prefer `packaged_product` with itemCount.\n"
    "- Populate hints relevant to the chosen category; omit irrelevant keys.\n"
    "- Do not include markdown, code fences, or extra keys.\n"
)

SHARED_OUTPUT_SCHEMA = (
    "Return ONLY a JSON object with this exact shape:\n"
    '{ "carbs": number, "protein": number, "fats": number, "calories": number, '
    '"analysis": string, "logName": string, '
    '"ingredients": [{"id": string, "name": string, "quantity": string, '
    '"carbs": number, "fats": number, "proteins": number, "unit"?: string, '
    '"preparation"?: string, "note"?: string}], '
    '"mealNotes"?: string, "confidence": number, "foodCategory": string }\n\n'
    "Field rules:\n"
    "- `ingredients` MUST include one item per identified ingredient/component.\n"
    "- Every ingredient MUST include non-empty `name` and `quantity`.\n"
    "- Every ingredient MUST include numeric `carbs`, `fats`, and `proteins` in grams (>= 0).\n"
    "- `logName` MUST be a short, human-friendly title (2-6 words).\n"
    '- `quantity` should be concise (e.g. "120 g", "1 tbsp", "to taste").\n'
    "- `analysis` should be brief and useful.\n"
    "- `confidence` is a number between 0.0 and 1.0 representing how certain you are.\n"
    "- `foodCategory` must be the category you were told this image belongs to.\n"
    "- Do not include markdown, code fences, or extra keys.\n\n"
)


def _desc_section(description: Optional[str]) -> str:
    if description:
        return f"Additional context from the user: {description}\n\n"
    return ""


def build_nutrition_label_prompt(description: Optional[str] = None) -> str:
    prompt = (
        "You are an expert nutritionist analysing a food product that has a visible "
        "nutrition facts label.\n\n"
    )
    prompt += SHARED_OUTPUT_SCHEMA
    prompt += (
        "Strategy:\n"
        "1. Read the printed nutrition values from the label exactly as shown.\n"
        "2. Use per-serving values. If the image shows total-package values, "
        "   divide by the number of servings.\n"
        "3. Cross-check: calories should roughly equal 4*carbs + 4*protein + 9*fats.\n"
        "4. Only estimate values that are NOT legible on the label. Note estimated "
        "   values in the `analysis` field.\n"
        "5. Set `confidence` high (>= 0.85) when the label is clearly legible.\n\n"
    )
    prompt += _desc_section(description)
    return prompt


def build_packaged_product_prompt(
    description: Optional[str] = None,
    hints: Optional[dict] = None,
) -> str:
    prompt = (
        "You are an expert nutritionist analysing a packaged/branded food product. "
        "No nutrition label is readable, so you must identify the product and look up "
        "its real nutritional information.\n\n"
    )
    prompt += SHARED_OUTPUT_SCHEMA
    prompt += "Strategy:\n"
    prompt += "1. Identify the product brand and exact name from packaging cues.\n"
    item_count_hint: Optional[int] = None
    if hints:
        brand = hints.get("brand")
        product_name = hints.get("productName")
        raw_item_count = hints.get("itemCount")
        if isinstance(raw_item_count, (int, float)) and raw_item_count > 0:
            item_count_hint = int(raw_item_count)
        if brand or product_name:
            prompt += (
                f"   (Preliminary identification suggests: "
                f"brand={brand or 'unknown'}, product={product_name or 'unknown'})\n"
            )
        if item_count_hint:
            prompt += f"   (Preliminary count suggests about {item_count_hint} visible packaged items)\n"
    prompt += (
        "2. Count all visible packaged products in the scene, including bottled/canned/carton beverages.\n"
        "3. Search the web for each identified product's official nutrition facts per serving.\n"
        "4. Use real per-serving values from trusted product data.\n"
        "5. Do NOT decompose branded products into sub-ingredients (no chocolate coating/caramel/nuts split).\n"
        "6. For repeated identical items, either aggregate in one ingredient with quantity like "
        '   "2 x 200 ml" or use separate entries, but totals MUST reflect all units shown.\n'
        "7. For different products in the same photo (e.g., porridge cartons + non-alcoholic beer), "
        "   return separate ingredient entries per product type.\n"
        "8. If only one clearly identified packaged product is present, a single ingredient entry is correct.\n"
        "9. If you cannot confidently identify a product, state so in `analysis` "
        "   and set `confidence` below 0.5.\n"
        "10. Default to standard serving sizes unless packaging suggests otherwise.\n\n"
        "11. Prefer official/manufacturer or trusted retailer/product sources. Do not guess values when source data is missing.\n"
        "12. Include a brief source hint in `mealNotes` (e.g., domain names used for lookup).\n\n"
        "IMPORTANT: Your response must be ONLY the raw JSON object, no markdown, "
        "no code fences, no explanation — just the JSON.\n\n"
    )
    prompt += _desc_section(description)
    return prompt


def build_simple_food_prompt(description: Optional[str] = None) -> str:
    prompt = (
        "You are an expert nutritionist analysing a single, clearly identifiable "
        "food item.\n\n"
    )
    prompt += SHARED_OUTPUT_SCHEMA
    prompt += (
        "Strategy:\n"
        "1. Identify the food item precisely (e.g. 'medium Fuji apple', not just 'fruit').\n"
        "2. Estimate the portion size using visual cues (hand, plate, container as reference).\n"
        "3. Apply well-established nutritional values for that food at the estimated portion.\n"
        "4. `ingredients` should contain exactly one item matching the identified food.\n"
        "5. Set `confidence` >= 0.8 for clearly recognisable items.\n\n"
    )
    prompt += _desc_section(description)
    return prompt


def build_complex_meal_prompt(description: Optional[str] = None) -> str:
    prompt = (
        "You are an expert nutritionist analysing a complex meal with multiple "
        "components.\n\n"
    )
    prompt += SHARED_OUTPUT_SCHEMA
    prompt += (
        "Think step by step — work through each stage carefully before producing "
        "the final JSON:\n\n"
        "1. **List every visible component/ingredient** — scan the entire plate or "
        "   container.\n"
        "2. **Estimate each portion size** — use the plate, bowl, utensils, or "
        "   hands as a size reference. Express in grams or common units.\n"
        "3. **Determine macros per component** — consider the preparation method "
        "   (fried adds fat, breading adds carbs, grilling drains fat, etc.).\n"
        "4. **Sum totals** — add all ingredient macros. Cross-check: total calories "
        "   should ≈ 4*carbs + 4*protein + 9*fats.\n"
        "5. **Assess confidence** — lower confidence when components overlap or are "
        "   partially hidden.\n\n"
        "Create one `ingredients` entry per distinct component (not sub-ingredients of "
        "a sauce, etc., unless visually prominent).\n\n"
    )
    prompt += _desc_section(description)
    return prompt


def build_beverage_prompt(description: Optional[str] = None) -> str:
    prompt = (
        "You are an expert nutritionist analysing a beverage.\n\n"
    )
    prompt += SHARED_OUTPUT_SCHEMA
    prompt += (
        "Strategy:\n"
        "1. Identify the beverage type (coffee, juice, smoothie, soda, water, "
        "   alcohol, etc.).\n"
        "2. Estimate the volume from the container size.\n"
        "3. Account for additions — sugar, milk, cream, syrup, ice displacement.\n"
        "4. If it is plain water or zero-calorie drink, still return valid zeros.\n"
        "5. `ingredients` should list the base drink plus any visible additions.\n\n"
    )
    prompt += _desc_section(description)
    return prompt


def build_text_only_prompt(description: Optional[str] = None) -> str:
    prompt = (
        "You are an expert nutritionist. The user described their food in text "
        "with no image.\n\n"
    )
    prompt += SHARED_OUTPUT_SCHEMA
    prompt += (
        "Strategy:\n"
        "1. Parse the description for specific food items and quantities.\n"
        "2. If quantities are vague, assume standard single-serving portions.\n"
        "3. Create one `ingredients` entry per distinct food item mentioned.\n"
        "4. Apply standard nutritional values for each item.\n"
        "5. Set `confidence` based on how specific the description is "
        "   (vague → lower, specific with quantities → higher).\n\n"
    )
    if description:
        prompt += f"User's description: {description}\n\n"
    return prompt


def get_analysis_prompt(
    category: str,
    description: Optional[str] = None,
    hints: Optional[dict] = None,
) -> tuple[str, int]:
    """Select the category-specific prompt and token budget.

    Returns:
        (prompt_text, max_tokens)
    """
    builders: dict[str, tuple] = {
        "nutrition_label": (build_nutrition_label_prompt, {"description": description}, 800),
        "packaged_product": (build_packaged_product_prompt, {"description": description, "hints": hints}, 1000),
        "simple_food": (build_simple_food_prompt, {"description": description}, 600),
        "complex_meal": (build_complex_meal_prompt, {"description": description}, 1500),
        "beverage": (build_beverage_prompt, {"description": description}, 600),
        "text_only": (build_text_only_prompt, {"description": description}, 800),
    }

    entry = builders.get(category)
    if entry is None:
        entry = builders["complex_meal"]

    fn, kwargs, max_tokens = entry
    return fn(**kwargs), max_tokens


def build_edit_log_prompt(ingredients_json: str, correction: str) -> str:
    prompt = (
        "You are an expert nutritionist. The user has an existing meal log and wants "
        "to make a correction. You will receive the current ingredients as JSON and a "
        "natural-language correction instruction.\n\n"
    )
    prompt += SHARED_OUTPUT_SCHEMA
    prompt += (
        "Strategy:\n"
        "1. Review the current ingredients carefully.\n"
        "2. Apply the user's correction: add, remove, or modify ingredients as described.\n"
        "3. Return the COMPLETE updated ingredient list (not just the changes).\n"
        "4. Recalculate all macro values for modified ingredients.\n"
        "5. Keep unchanged ingredients as-is.\n"
        "6. Set `confidence` based on how clear the correction is.\n\n"
        f"Current ingredients:\n```json\n{ingredients_json}\n```\n\n"
        f"User's correction: {correction}\n\n"
    )
    return prompt
