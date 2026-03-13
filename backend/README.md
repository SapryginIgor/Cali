# Food Analysis API (Python/FastAPI)

Python/FastAPI backend for food image analysis using OpenAI.

## Stack

- FastAPI + Pydantic v2
- OpenAI Python SDK
- SlowAPI rate limiting
- Pillow image validation

## Setup

1. Create and activate a virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Configure env:

```bash
cp .env.example .env
```

Required variables:

- `OPENAI_API_KEY`
- `PORT` (default `8000`)

Optional:

- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs:

- Swagger: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## API

### `POST /api/analyze-food`

Accepts either:

- JSON body with base64 `image`
- Multipart form-data with file field `image`

Optional fields:

- `description`
- `userId`

Response shape:

```json
{
  "carbs": 45.0,
  "protein": 20.0,
  "fats": 15.0,
  "calories": 380.0,
  "analysis": "Short analysis",
  "logName": "Chicken and Rice Bowl",
  "ingredients": [
    {
      "id": "ing-1",
      "name": "Chicken breast",
      "quantity": "150 g",
      "carbs": 0,
      "fats": 5,
      "proteins": 31
    }
  ],
  "mealNotes": "Optional notes"
}
```

### `GET /health`

Returns `{ "status": "ok" }`.

## Testing

```bash
pytest
```

## Deployment

Python runtime only:

- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## Migration Note

This backend is the single source of truth. Legacy TypeScript/Express backend runtime files were removed to avoid dual-runtime ambiguity.
