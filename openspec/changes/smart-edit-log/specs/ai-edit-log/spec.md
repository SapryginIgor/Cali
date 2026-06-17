# Spec: AI Edit Log

## Capability
`ai-edit-log` — AI-powered correction bar in the edit modal and backend endpoint for processing natural-language edits against existing ingredients.

## Backend

### New endpoint: `POST /api/edit-log`

**Request model** (`EditLogRequest` in `app/models/requests.py`):
- `ingredients`: list of `IngredientItem` — current ingredients
- `correction`: str — natural-language correction text (max 500 chars)

**Response**: Returns `AnalyzeFoodResponse` (same `NutritionResult` shape as analyze-food).

**Service function** (`edit_log` in `app/services/openai.py`):
- Calls GPT-4.1 with a prompt containing:
  - Current ingredients as JSON
  - The user's correction text
  - Instructions to return the full updated ingredient list (not a delta)
- Uses `json_object` response format
- Returns `NutritionResult`

**Prompt** (`build_edit_log_prompt` in `app/services/prompts.py`):
- System: "You are an expert nutritionist. The user has an existing meal log and wants to make a correction."
- Includes `SHARED_OUTPUT_SCHEMA` for consistent output format
- Shows current ingredients as JSON context
- Shows the user's correction instruction
- Instructs the model to return the complete updated ingredient list

**Route** (in `app/routes/analyze.py`):
- Uses `require_active_subscription` dependency (same as analyze-food)
- Uses rate limiter
- Parses JSON body as `EditLogRequest`
- Calls `edit_log(request.ingredients, request.correction)`
- Returns `AnalyzeFoodResponse`

### Frontend

**New function** (`editLogWithAI` in `lib/ai.ts`):
- Signature: `editLogWithAI(ingredients: IngredientItem[], correction: string): Promise<NutritionResult>`
- Calls `POST ${BACKEND_URL}/api/edit-log` with JSON body `{ ingredients, correction }`
- Includes Supabase auth token in `Authorization` header
- Uses same timeout as `callBackendAPI`
- Returns parsed `NutritionResult`

**Edit modal UI** (in `app/(main)/index.tsx`):
- Add an AI correction bar pinned at the bottom of the edit modal (outside `ScrollView`, inside `KeyboardAvoidingView`)
- Text input with placeholder "What to change?" and a send button (use `Send` icon from lucide)
- New state: `editAICorrection` (string), `editAILoading` (boolean)
- On send:
  - Set `editAILoading = true`
  - Call `editLogWithAI(editIngredients, editAICorrection)`
  - On success: update `editIngredients` and `editDescription` from response
  - On error: show `Alert.alert`
  - Set `editAILoading = false`, clear `editAICorrection`
- While loading: show `ActivityIndicator`, disable the bar
