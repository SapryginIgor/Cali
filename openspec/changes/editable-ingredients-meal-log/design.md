## Context

Meal logging currently treats a meal as mostly unstructured text, which limits downstream editing and consistency for complex meals with many components. The requested change requires the logging flow to capture ingredient-level data, including per-ingredient macro values (`carbs`, `fats`, `proteins`), and make that data editable later without losing fidelity. This affects prompt construction, response parsing, validation rules, and persisted meal log schema.

## Goals / Non-Goals

**Goals:**
- Capture meal logs as structured ingredient arrays rather than only free-form meal text.
- Reformulate the LLM prompt to explicitly request ingredient objects with stable fields, including macro fields.
- Validate and normalize structured output so malformed responses fail safely.
- Support ingredient-level edits (add, update, remove) after log creation, including macro editing per ingredient.

**Non-Goals:**
- Full nutrition computation redesign or macro inference improvements.
- Automatic ingredient canonicalization across external food databases.
- Redesign of unrelated logging UX outside ingredient-list editing.

## Decisions

- **Decision: Use a strict ingredient object contract in prompt and parser.**  
  Define each ingredient as `{ name, quantity, carbs, fats, proteins, unit?, preparation?, note? }` with required `name`, `quantity`, `carbs`, `fats`, and `proteins`.  
  **Rationale:** A stable contract minimizes ambiguity and reduces parser branching.  
  **Alternative considered:** Continue parsing free-form ingredient text; rejected because it remains brittle and difficult to edit atomically.

- **Decision: Require machine-readable response shape from the model.**  
  Prompt instructs the model to return a JSON object with `ingredients` array and optional `mealNotes`, and backend rejects non-conforming payloads with fallback handling.  
  **Rationale:** Structured output improves reliability and supports deterministic persistence.  
  **Alternative considered:** Regex extraction from plain text; rejected due to high error rate for complex meals.

- **Decision: Persist ingredients as first-class data on meal logs.**  
  Store ingredient arrays directly in meal log records (or related normalized table/document field, depending on existing storage pattern), including `carbs`, `fats`, and `proteins` at ingredient level.  
  **Rationale:** Editing and querying are simpler when ingredient entities and their macros are persisted explicitly.  
  **Alternative considered:** Store only serialized text snapshots; rejected because partial edits become unsafe and expensive.

- **Decision: Expose ingredient edit operations as atomic mutations.**  
  Editing flow supports add/update/remove ingredient actions with validation before save, and allows independent macro edits on a single ingredient row.  
  **Rationale:** Atomic mutations reduce accidental overwrites and improve user trust.  
  **Alternative considered:** Replace whole list on every edit; rejected because it increases conflict risk and payload churn.

## Risks / Trade-offs

- **[Model output drift]** Prompted JSON may still contain invalid fields or shape deviations.  
  **Mitigation:** Schema validation, guarded parsing, and clear retry/fallback messaging.

- **[Backward compatibility]** Existing logs may not have ingredient arrays.  
  **Mitigation:** Support legacy reads with nullable/empty ingredients and migrate lazily on edit.

- **[Editing complexity]** Ingredient-level edits add UI/API complexity versus plain text edits.  
  **Mitigation:** Keep mutation surface minimal and reuse existing validation/form components where possible.

- **[Data quality variance]** Users may enter inconsistent quantities/units.  
  **Mitigation:** Normalize units where possible and preserve original text in optional notes when normalization is uncertain.

- **[Macro accuracy variance]** Model-generated macros may be incomplete or approximate.  
  **Mitigation:** Require explicit macro fields, validate numeric ranges, and allow direct user edits per ingredient.

## Migration Plan

1. Extend meal log schema to include structured ingredients with backward-compatible defaults and required macro fields.
2. Update create-log flow to use the new prompt and parser contract.
3. Add validation and persistence for ingredient arrays including per-item macro fields.
4. Add ingredient-level edit endpoints/UI actions for base fields and macros.
5. Roll out with compatibility for legacy entries and monitor parse/validation failure rates.

Rollback strategy: disable structured parsing path and fall back to legacy free-form logging while preserving newly stored ingredient data.

## Open Questions

- Should macro fields allow `null` during draft creation and become required only before final save?
- Do we need hard limits on ingredient count per meal to protect prompt/token usage and UI performance?
- Should ingredient edits keep audit history per item or rely on existing meal log revision history?
