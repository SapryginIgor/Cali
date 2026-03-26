## 1. Backend Models & Shared Constants

- [x] 1.1 Define `FoodCategory` enum/literal type in `backend/app/models/api.py` with values: `nutrition_label`, `packaged_product`, `simple_food`, `complex_meal`, `beverage`, `text_only`
- [x] 1.2 Add `ClassificationResult` model to `backend/app/models/api.py` with fields `category: FoodCategory` and `hints: dict` (brand, productName, itemCount, hasLabel)
- [x] 1.3 Add optional `confidence: float` and `foodCategory: str` fields to `NutritionResult` in `backend/app/models/api.py`
- [x] 1.4 Add optional `confidence` and `foodCategory` fields to `AnalyzeFoodResponse` in `backend/app/models/responses.py`

## 2. Prompt Templates Module

- [x] 2.1 Create `backend/app/services/prompts.py` with a `CLASSIFICATION_PROMPT` constant — the system prompt for the classification call (instructs model to return category + hints JSON, low-detail)
- [x] 2.2 Add `SHARED_OUTPUT_SCHEMA` constant in `prompts.py` — the JSON shape section reused by all category analysis prompts (NutritionResult + confidence + foodCategory)
- [x] 2.3 Add `build_nutrition_label_prompt(description)` — extracts printed values, cross-checks math, max_tokens=800
- [x] 2.4 Add `build_packaged_product_prompt(description, hints)` — identifies brand/product, uses known nutritional data, flags uncertainty, max_tokens=1000
- [x] 2.5 Add `build_simple_food_prompt(description)` — direct identification + standard portion, max_tokens=600
- [x] 2.6 Add `build_complex_meal_prompt(description)` — step-by-step decomposition chain (list components, estimate portions, per-component macros, sum totals), max_tokens=1500
- [x] 2.7 Add `build_beverage_prompt(description)` — identify type, estimate volume, account for additions, max_tokens=600
- [x] 2.8 Add `build_text_only_prompt(description)` — parse text for food items, no vision, max_tokens=800
- [x] 2.9 Add `get_analysis_prompt(category, description, hints)` dispatcher function that selects the correct prompt builder and returns `(prompt_text, max_tokens)`

## 3. Classification Function

- [x] 3.1 Add `classify_food_image(image_base64, description)` function in `backend/app/services/openai.py` that makes a GPT-4o call with `detail: "low"`, max_tokens=200, json_object format, and returns a `ClassificationResult`
- [x] 3.2 Implement fallback logic: if the classification call fails or returns an unrecognized category, default to `complex_meal` with empty hints
- [x] 3.3 Handle `text_only` detection: if no image is provided, skip the classification call and return `text_only` directly

## 4. Branched Analysis Pipeline

- [x] 4.1 Refactor `analyze_food_image` in `openai.py` to call `classify_food_image` first, then use `get_analysis_prompt` to get category-specific prompt and token budget
- [x] 4.2 Update the `make_request` inner function to accept dynamic `max_tokens` and prompt text from the dispatcher instead of the hardcoded `build_prompt`
- [x] 4.3 After analysis, populate `confidence` and `foodCategory` fields on the `NutritionResult` from the model response and classification result
- [x] 4.4 Implement heuristic confidence adjustment: reduce by 0.2 if per-ingredient macro sums diverge >20% from reported totals; reduce by 0.3 for unidentified packaged products
- [x] 4.5 Remove the old single `build_prompt` function (now replaced by the prompts module)

## 5. Frontend Type Updates

- [x] 5.1 Add optional `confidence?: number` and `foodCategory?: string` fields to `NutritionResult` interface in `lib/ai.ts`
- [x] 5.2 Add optional `confidence?: number` and `foodCategory?: string` fields to `FoodEntry` in `constants/types.ts`
- [x] 5.3 Update `callBackendAPI` in `lib/ai.ts` to pass through the new optional fields from the backend response
- [x] 5.4 Update `normalizeIngredientsFromApi` (if needed) and the response mapping in `callBackendAPI` to preserve `confidence` and `foodCategory`

## 6. Testing & Validation

- [ ] 6.1 Manually test with a nutrition label image and verify category is `nutrition_label` with extracted printed values
- [ ] 6.2 Manually test with a branded packaged product and verify category is `packaged_product` with brand hints
- [ ] 6.3 Manually test with a complex multi-component meal and verify category is `complex_meal` with per-ingredient decomposition
- [ ] 6.4 Manually test with a text-only description (no image) and verify category is `text_only`
- [x] 6.5 Verify backward compatibility: existing clients without `confidence`/`foodCategory` handling still parse responses correctly
