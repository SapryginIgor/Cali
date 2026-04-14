# Tasks: Smart Edit Log

## auto-recalc-macros

- [x] Remove manual macro state (`editCarbs`, `editProtein`, `editFats`, `editCalories`) and their `TextInput` fields from the edit modal; replace with a read-only computed summary row showing totals derived from `editIngredients`
- [x] Update `handleSaveEditedEntry` to compute nutrition totals from `editIngredients` instead of reading from removed state variables

## ai-edit-log

- [x] Add `EditLogRequest` model to `backend/app/models/requests.py` with `ingredients` (list of IngredientItem) and `correction` (str)
- [x] Add `build_edit_log_prompt` to `backend/app/services/prompts.py` that takes current ingredients JSON + correction text and returns a prompt using `SHARED_OUTPUT_SCHEMA`
- [x] Add `edit_log` service function to `backend/app/services/openai.py` that calls GPT-4.1 with the edit prompt and returns `NutritionResult`
- [x] Add `POST /api/edit-log` route to `backend/app/routes/analyze.py` that accepts `EditLogRequest`, calls `edit_log`, and returns `AnalyzeFoodResponse`
- [x] Add `editLogWithAI(ingredients, correction)` function to `lib/ai.ts` that calls the new backend endpoint with auth
- [x] Add AI correction bar UI to the edit modal in `app/(main)/index.tsx` — text input + send button pinned at bottom, with loading state, calling `editLogWithAI` and updating `editIngredients`/`editDescription` on success
