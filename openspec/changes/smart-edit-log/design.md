## Context

The edit modal in `app/(main)/index.tsx` lets users manually edit a meal log's description, ingredients (name, quantity, per-ingredient macros), and total macros (protein, carbs, fats, calories). The total macros are independent fields — they don't sync with ingredient values. The backend already has a food analysis pipeline (`analyze_food_image`) that returns structured nutrition data.

## Goals / Non-Goals

**Goals:**
- AI correction bar in the edit modal that sends current ingredients + a natural-language instruction to the backend and receives updated ingredients/macros
- Auto-recalculate totals from ingredient sums whenever ingredients change (including after AI edits)
- Remove manual total macro fields — they become read-only derived values

**Non-Goals:**
- Re-analyzing the original image during edits
- Undo/redo for AI-suggested changes
- Streaming or partial AI responses

## Decisions

**1. New backend endpoint `POST /api/edit-log`**
A dedicated endpoint rather than reusing `/api/analyze-food` because the input shape is different: we send existing ingredients + correction text (no image). The endpoint calls GPT-4.1 with a prompt that includes the current ingredients as JSON context and the user's correction instruction, returning the full updated ingredients list and recalculated nutrition in the same `NutritionResult` shape.

Alternative: client-side prompt construction sent to the existing endpoint — rejected because the existing endpoint is image-centric and requires an image.

**2. Prompt structure for edits**
The prompt includes: current ingredients as JSON, the user's correction text, and instructions to return the full updated ingredient list (not just the delta). This ensures the response is self-contained and can directly replace the edit state.

**3. Auto-recalculation replaces manual macro fields**
When ingredients change (manual edit, AI edit, add, remove), totals are recomputed as sums. The four manual macro `TextInput` fields become read-only display values. Calories are computed as `(carbs * 4) + (protein * 4) + (fats * 9)` from the ingredient sums.

Alternative: Keep manual macro fields editable alongside auto-calc — rejected because it creates confusing conflicts.

**4. AI bar UX**
The bar sits at the bottom of the edit modal (pinned, outside the `ScrollView`), similar to the main screen's inline input bar. It has a text input ("What to change?") and a send button. While the AI request is in flight, show a loading indicator and disable the bar. On success, update `editIngredients` / `editDescription` state. On error, show an alert.

**5. Frontend AI call**
Add `editLogWithAI(ingredients, correction)` to `lib/ai.ts` that calls `POST /api/edit-log`. The function sends the Supabase auth token like `callBackendAPI` does.

## Risks / Trade-offs

- **AI may misunderstand corrections** → acceptable; the user can review changes in the edit modal before saving
- **Removing manual macro fields** → users lose the ability to override totals independently of ingredients; this is an acceptable simplification since ingredients are the source of truth
- **Latency** → AI edits take a few seconds; the loading indicator communicates this
