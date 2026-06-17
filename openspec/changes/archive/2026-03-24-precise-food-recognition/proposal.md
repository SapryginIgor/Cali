## Why

The current food analysis uses a single generic GPT-4o prompt for every image, whether it's a barcode on a protein bar, a packaged product with a nutrition label, a complex home-cooked meal, or a restaurant dish. This one-size-fits-all approach limits accuracy: the model can't leverage nutrition label data when it's visible, can't look up known products, and is constrained to 700 max tokens of reasoning regardless of meal complexity. Since processing happens asynchronously, we can afford deeper analysis without blocking the user — but we're not taking advantage of that headroom.

## What Changes

- Introduce a classification step that inspects the image first and determines the food category (packaged product with label, barcode/branded item, single-item simple food, complex multi-component meal, drink/beverage, or text-only description).
- Route each category to a specialized prompt chain with tailored instructions, relevant few-shot examples, and appropriate reasoning depth.
- Increase token budget for complex meals to allow the model to reason through portion estimation, cooking method impact, and per-ingredient decomposition.
- For packaged products and visible nutrition labels, instruct the model to extract printed values directly rather than estimating.
- Add a confidence score to the response so the frontend can flag uncertain analyses for user review.
- Structure the backend to support the branched pipeline without changing the external API contract (`POST /api/analyze-food` request/response shape stays the same).

## Capabilities

### New Capabilities
- `food-image-classification`: Initial vision pass that categorizes the input image into a food type (packaged-with-label, branded-product, simple-food, complex-meal, beverage, text-only) and extracts preliminary metadata used to route downstream analysis.
- `branched-analysis-pipeline`: Category-aware prompt routing that selects specialized system prompts, token budgets, and post-processing rules per food type, all executed server-side within the existing async analysis flow.

### Modified Capabilities
- None.

## Impact

- Backend `app/services/openai.py` — restructured into a classify-then-analyze two-step pipeline.
- Backend prompt templates — new per-category system prompts replacing the current single `build_prompt`.
- Backend `app/models/api.py` — `NutritionResult` extended with `confidence` and `foodCategory` fields.
- Frontend types (`constants/types.ts`, `lib/ai.ts`) — updated to handle new optional response fields.
- Token cost per analysis may increase for complex meals (offset by being more efficient for simple/packaged items).
- No database schema changes required — fields are added to the JSON response within the existing API contract.
