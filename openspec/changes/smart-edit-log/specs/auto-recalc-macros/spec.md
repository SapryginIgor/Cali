# Spec: Auto-Recalculate Macros

## Capability
`auto-recalc-macros` — Automatic recalculation of total nutrition values from ingredient-level data in the edit modal.

## Changes

### Edit modal (in `app/(main)/index.tsx`):

**Remove manual macro input fields:**
- Remove the `editNutritionGrid` section with the four `TextInput` fields for protein, carbs, fats, calories
- Remove `editCarbs`, `editProtein`, `editFats`, `editCalories` state variables

**Add derived display:**
- Replace the manual inputs with a read-only summary row showing computed totals
- Compute from `editIngredients`:
  - `protein = sum of ingredient.proteins`
  - `carbs = sum of ingredient.carbs`
  - `fats = sum of ingredient.fats`
  - `calories = (carbs * 4) + (protein * 4) + (fats * 9)`

**Update `handleSaveEditedEntry`:**
- Instead of reading from `editCarbs`/`editProtein`/`editFats`/`editCalories` state, compute totals from `editIngredients` at save time
- Remove the `invalidNumber` validation for manual macro fields (no longer needed since values are derived)

**Update `openEditModal` (or wherever edit state is initialized):**
- Stop setting `editCarbs`, `editProtein`, `editFats`, `editCalories` state
