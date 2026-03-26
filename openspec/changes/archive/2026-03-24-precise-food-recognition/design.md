## Context

The backend (`backend/app/services/openai.py`) currently sends every food image through a single GPT-4o call with one generic prompt, a fixed 700-token budget, and `json_object` response format. The prompt asks the model to simultaneously identify the food, decompose ingredients, estimate portions, and compute per-ingredient macros — all in one pass regardless of whether the image shows a nutrition label, a branded snack bar, or a 12-component dinner plate.

Processing is already asynchronous from the user's perspective (the mobile app creates a `pending` entry and the backend analyzes in the background), so latency for multi-step reasoning is not user-facing. The external API contract (`POST /api/analyze-food` returning `NutritionResult`) must remain stable.

## Goals / Non-Goals

**Goals:**
- Maximize nutritional accuracy across diverse input types by using category-specific prompting strategies.
- Introduce a lightweight classification step that routes images to the best-fit analysis branch.
- Allow richer model reasoning for complex meals without penalizing simple items.
- Add a confidence signal so uncertain analyses can be flagged downstream.
- Keep all branching logic server-side with no frontend workflow changes.

**Non-Goals:**
- External nutrition database lookups or barcode API integration (future enhancement).
- Changing the mobile app's capture/submission flow.
- Multi-image or multi-angle analysis.
- User-facing category selection UI.

## Decisions

### Decision: Two-step classify-then-analyze pipeline

Replace the single `analyze_food_image` call with two sequential GPT-4o calls:

1. **Classification call** — A fast, low-token call (`max_tokens ~200`) with `detail: "low"` that receives the image + optional description and returns a structured JSON:
   ```json
   {
     "category": "nutrition_label" | "packaged_product" | "simple_food" | "complex_meal" | "beverage" | "text_only",
     "hints": { "brand": "...", "itemCount": 3, "hasLabel": true, ... }
   }
   ```

2. **Analysis call** — Uses the classification result to select a category-specific system prompt and token budget, then performs the full nutritional analysis.

**Rationale:** Separating classification from analysis lets each step focus. The classifier runs cheaply (low-detail image, small output) and the analyzer can invest its full token budget on domain-specific reasoning. Total cost increase is marginal because the classifier is ~10x cheaper than the analyzer.

**Alternative considered:** Single call with a longer prompt covering all cases. Rejected because prompt length degrades focus, and the model can't self-select reasoning depth.

### Decision: Six food categories with distinct prompt strategies

| Category | Trigger signals | Prompt strategy | Token budget |
|---|---|---|---|
| `nutrition_label` | Visible nutrition facts panel / ingredient list | Extract printed values directly; cross-check totals against per-serving math | 800 |
| `packaged_product` | Branded packaging, recognizable product, no readable label | Identify the product by brand/name; use known nutritional knowledge for that product; note if uncertain | 1000 |
| `simple_food` | Single clearly identifiable food item (apple, boiled egg, slice of bread) | Direct identification + standard portion estimation | 600 |
| `complex_meal` | Multiple components, plated dish, mixed foods | Decompose into individual components; estimate each portion; reason through cooking method impact on macros; chain-of-thought encouraged | 1500 |
| `beverage` | Drink in cup/glass/bottle | Identify beverage type, estimate volume, account for additions (sugar, milk, cream) | 600 |
| `text_only` | No image provided, only text description | Parse description for food items, apply standard nutritional knowledge | 800 |

Each category's system prompt follows a structure:
1. **Role statement** — "You are a nutritionist analyzing a {category}..."
2. **Category-specific instructions** — What to pay attention to for this type
3. **Reasoning guidance** — For complex meals, explicitly ask for step-by-step portion reasoning before the final JSON
4. **Output schema** — Same `NutritionResult` JSON shape for all categories, plus `confidence` (0.0–1.0) and `foodCategory` string

**Rationale:** Different food types have fundamentally different analysis strategies. A nutrition label needs OCR-like extraction; a complex meal needs compositional decomposition. Tailoring prompts per category significantly improves accuracy over a generic prompt.

**Alternative considered:** Three broad categories (labeled, unlabeled, text). Rejected because the variance within "unlabeled" (simple apple vs. multi-course dinner) is too large for a single prompt to handle well.

### Decision: Structured chain-of-thought for complex meals

For `complex_meal` and `packaged_product` categories, the system prompt explicitly requests reasoning before the final answer:

```
Think step by step:
1. List every visible component/ingredient
2. Estimate the portion size of each (use the plate/container as reference)
3. For each component, determine macros considering preparation method
4. Sum totals and cross-check against calorie expectations for a meal of this type
5. Return the final JSON
```

The model response is still `json_object` format, but we increase `max_tokens` to give room for the implicit reasoning the model performs within structured output mode.

**Rationale:** GPT-4o produces more accurate portion estimates when guided through explicit decomposition steps, especially for dishes with 4+ components.

**Alternative considered:** Asking the model to output its reasoning in a separate field. Rejected because it adds response size without adding user value, and `json_object` mode handles reasoning internally.

### Decision: Confidence score based on classifier + analyzer agreement

The analysis response includes a `confidence` field (0.0 to 1.0) that the model self-reports. Additionally, the backend computes a heuristic confidence modifier:

- If classifier `hints.itemCount` roughly matches the number of returned ingredients: no penalty
- If the sum of ingredient macros diverges >20% from the reported totals: reduce confidence by 0.2
- If the category is `packaged_product` and the model says "uncertain" or "could not identify brand": reduce confidence by 0.3

The final confidence is `min(model_confidence, heuristic_adjusted)` and is returned in the API response. Existing frontend code ignores unknown fields, so this is backward-compatible.

**Rationale:** Self-reported confidence alone is unreliable. The heuristic cross-check catches internal inconsistencies that signal the model was guessing.

**Alternative considered:** No confidence score, just always return data. Rejected because users benefit from knowing when an analysis is uncertain, enabling future UX for "review this entry."

### Decision: Extend NutritionResult with optional fields, preserve backward compat

Add two optional fields to the Python `NutritionResult` model and TypeScript `NutritionResult` interface:
- `confidence: Optional[float]` (0.0–1.0)
- `foodCategory: Optional[str]` (the classified category)

Both default to `None`/`undefined` so existing clients that don't expect them continue working. The frontend types are updated but no UI changes are required in this change.

**Rationale:** Extending with optional fields is the least disruptive way to surface new metadata.

### Decision: Keep classification and analysis as two separate OpenAI calls (not a single multi-turn conversation)

Each step is an independent `chat.completions.create` call rather than a multi-turn conversation.

**Rationale:** Independent calls are simpler to retry individually, easier to test/mock, and let us use different parameters (image detail, token limits) per step. Multi-turn would carry classification context automatically but adds coupling and prevents per-step parameter tuning.

## Risks / Trade-offs

- [Added latency from two API calls instead of one] → The classification call uses `detail: "low"` and ~200 max tokens, adding roughly 1–2s. Since analysis is async/background, this is invisible to users.
- [Classification errors cascade to wrong analysis branch] → The analyzer still receives the original image and can self-correct. Categories are designed so adjacent misclassification (e.g., `simple_food` analyzed as `complex_meal`) produces slightly verbose but not wrong results.
- [Increased API cost per analysis] → Classification call costs ~$0.001 with low-detail image. Total cost increase is <15% per analysis.
- [Prompt drift across six category templates] → All templates share the same output schema section (extracted to a shared constant). Category-specific instructions are isolated in clearly separated prompt builder functions.
- [Model confidence self-reporting is unreliable] → Mitigated by the heuristic cross-check. Confidence is advisory, not blocking.

## Migration Plan

1. Add new prompt builder module (`backend/app/services/prompts.py`) with classifier and per-category analysis prompts alongside the existing `openai.py`.
2. Add `classify_food_image` function to `openai.py` that performs the classification step.
3. Refactor `analyze_food_image` to call classifier first, then dispatch to category-specific analysis.
4. Add optional `confidence` and `foodCategory` fields to `NutritionResult` in `backend/app/models/api.py`.
5. Update frontend types in `constants/types.ts` and `lib/ai.ts` to accept optional new fields.
6. Deploy backend changes — the API contract is backward-compatible so frontend can deploy independently.
7. Existing E2E tests and mock paths are unaffected (they bypass the backend entirely).

**Rollback:** Revert `analyze_food_image` to the single-call version. The optional response fields become absent, which existing clients already handle.

## Open Questions

- Should the classifier output be logged/stored for analytics on category distribution and misclassification rates?
- What is the target confidence threshold below which a future UI would prompt users to review/correct the entry?
- Should `text_only` category use a different, cheaper model (e.g., gpt-4o-mini) since no vision is needed?
