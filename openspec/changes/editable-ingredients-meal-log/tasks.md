## 1. Data model and validation

- [x] 1.1 Extend meal log schema/types to include a structured `ingredients` array with required fields (`name`, `quantity`, `carbs`, `fats`, `proteins`) and optional metadata (`unit`, `preparation`, `note`).
- [x] 1.2 Implement schema validation/normalization for structured ingredient payloads, including numeric macro validation, and ensure malformed payloads are rejected with recoverable errors.
- [x] 1.3 Add backward-compatible handling for legacy meal logs that do not contain ingredient arrays or macro fields.

## 2. Prompt and parsing pipeline

- [x] 2.1 Reformulate the meal logging prompt to require machine-readable output containing `ingredients` with `carbs`, `fats`, `proteins`, and optional meal notes.
- [x] 2.2 Update model response parsing to consume structured output and map ingredient macros into the validated schema.
- [x] 2.3 Implement fallback/retry behavior for invalid model responses so malformed ingredient or macro data is never persisted.

## 3. Ingredient editing flows

- [x] 3.1 Add ingredient-level add/update/remove operations in the meal log update path (API/service layer), including macro fields.
- [x] 3.2 Update client-side meal log editing UI/forms to edit individual ingredient rows with per-row `carbs`, `fats`, and `proteins`.
- [x] 3.3 Ensure edit operations are atomic so updating one ingredient or its macros never overwrites unrelated ingredients.

## 4. Tests and rollout safety

- [x] 4.1 Add tests for creating logs with multiple ingredients, including required macro-field enforcement.
- [x] 4.2 Add tests for invalid structured output handling, especially missing/non-numeric macro values, and fallback behavior.
- [x] 4.3 Add tests for ingredient add/update/remove plus macro edit behavior and legacy-log compatibility.
