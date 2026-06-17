## Why

Editing a meal log is currently a manual process: users must individually tweak ingredient names, quantities, and macros by hand. If they realize the portion was larger or they forgot a side, they have to do math themselves. Two improvements are needed: (1) an AI-powered "what to change" bar so users can describe corrections in natural language, and (2) auto-recalculation of total nutrition from ingredient-level edits.

## What Changes

- Add an AI correction bar at the bottom of the edit modal — a text input with placeholder "What to change?" and a send button. User describes a correction (e.g., "portion was double", "add a side of rice"), the app sends the current ingredients + correction text to the backend, and the AI returns updated ingredients/macros that replace the current edit state.
- Add a new backend endpoint `POST /api/edit-log` that accepts current ingredients + a correction prompt and returns updated ingredients and nutrition.
- Auto-recalculate the total macros (protein, carbs, fats, calories) from ingredient sums whenever an ingredient is added, edited, or removed in the edit modal. Remove the manual total macro input fields since they will be derived.

## Capabilities

### New Capabilities
- `ai-edit-log`: AI-powered correction bar in the edit modal and backend endpoint for processing natural-language edits against existing ingredients
- `auto-recalc-macros`: Automatic recalculation of total nutrition values from ingredient-level data in the edit modal

### Modified Capabilities

## Impact

- `app/(main)/index.tsx` — edit modal UI: add AI bar, remove manual macro inputs, add recalculation logic
- `lib/ai.ts` — add function to call the new edit endpoint
- `backend/app/routes/analyze.py` — add `POST /api/edit-log` endpoint
- `backend/app/services/openai.py` — add service function for edit-based AI analysis
- `backend/app/services/prompts.py` — add prompt template for edit corrections
- `backend/app/models/requests.py` — add request model for edit endpoint
