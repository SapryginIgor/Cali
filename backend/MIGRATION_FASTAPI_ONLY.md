# FastAPI-Only Backend Migration

## What Changed

- Consolidated backend runtime to Python/FastAPI.
- Removed TypeScript/Express backend runtime files under `backend/src/**`.
- Removed backend Node runtime artifacts:
  - `backend/package.json`
  - `backend/package-lock.json`
  - `backend/tsconfig.json`
  - `backend/vercel.json`
- Updated deployment config:
  - `backend/railway.json` now uses Python build/start commands.

## Parity Inventory (TS -> FastAPI)

- Request paths:
  - JSON base64 input: supported.
  - Multipart input: supported.
- Response shape:
  - Includes macros (`carbs`, `protein`, `fats`, `calories`), `analysis`, `logName`, `ingredients`, `mealNotes`.
- OpenAI handling:
  - Python service now requests structured JSON with ingredient-level macros.
  - Python service validates via Pydantic models and applies retry/fallback on invalid structured output.
- Error behavior:
  - Validation and service errors return standardized error payloads through FastAPI handlers.

## Smoke Verification

Recommended checks:

1. Run backend tests:

```bash
cd backend
pytest
```

2. Run local API:

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

3. Verify endpoint:

```bash
curl -X POST http://localhost:8000/api/analyze-food \
  -H "Content-Type: application/json" \
  -d '{"image":"data:image/png;base64,<...>","description":"test"}'
```

## Rollback

If blocking regressions appear:

1. Revert this migration commit/change.
2. Restore deleted TypeScript backend files from version control history.
3. Restore previous deployment config values if infrastructure expects Node commands.
