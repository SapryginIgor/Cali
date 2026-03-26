## Why

Meal logs currently capture meals as unstructured text, which makes it hard to represent complex meals made of multiple ingredients and impossible to reliably edit ingredient details later. We need ingredient-level macro fields so users can accurately review and correct carbs, fats, and proteins per ingredient over time.

## What Changes

- Add support for meal logs to include an editable list of ingredients rather than a single free-form meal description.
- Extend each ingredient with editable `carbs`, `fats`, and `proteins` fields (grams) in addition to base ingredient metadata.
- Reformulate the meal logging prompt so it explicitly requests ingredient-level details (name, quantity, macros, and optional notes) in a parseable format.
- Introduce structured output handling for meal logging responses so ingredient items are validated and stored consistently.
- Update meal log editing flow to allow adding, removing, and updating individual ingredients and their macro fields after initial log creation.

## Capabilities

### New Capabilities
- `meal-log-ingredients`: Support creating and editing meal log entries with a structured list of ingredient items.

### Modified Capabilities
- None.

## Impact

- Affected code: meal logging prompt construction, response parsing/validation, meal log persistence model, and meal log edit UI/API handlers.
- Affected data/API surface: meal log payload shape will include an ingredients array with structured fields including per-item `carbs`, `fats`, and `proteins`.
- Dependencies/systems: any LLM integration used for meal parsing and any storage layer/query logic that currently assumes a single meal text field.
