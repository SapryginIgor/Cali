# Food Analysis API - FastAPI Backend

Python/FastAPI backend for analyzing food images and extracting nutritional information using OpenAI GPT-4 Vision.

## Setup

### Prerequisites

- Python 3.11+
- pip (Python package manager)

### Installation

1. Create a virtual environment (recommended):
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

4. Edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=sk-your-openai-api-key-here
PORT=8000
```

## Running Locally

### Development Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

### Docker

From the project root:

```bash
# Создайте .env в корне репозитория (или скопируйте из backend/.env.example)
# и задайте OPENAI_API_KEY

docker compose up --build
```

API будет доступен на `http://localhost:8000`. Только образ бэкенда: `docker build -t cali-backend ./backend && docker run -p 8000:8000 -e OPENAI_API_KEY=sk-... cali-backend`.

### API Documentation

FastAPI automatically generates interactive API documentation:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### POST /api/analyze-food

Analyze a food image and extract nutritional information.

**Request Formats:**

1. **JSON (base64 image):**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "description": "Optional description",
  "userId": "Optional user ID"
}
```

2. **Multipart Form Data:**
- `image`: Image file (JPEG, PNG, WebP, max 10MB)
- `description`: Optional text description (max 500 chars)
- `userId`: Optional user identifier

**Response:**
```json
{
  "carbs": 45.0,
  "protein": 20.0,
  "fats": 15.0,
  "calories": 380.0,
  "analysis": "This appears to be a healthy meal..."
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Environment Variables

- `OPENAI_API_KEY`: OpenAI API key (required)
- `PORT`: Server port (default: 8000)
- `RATE_LIMIT_WINDOW_MS`: Rate limit window in milliseconds (default: 900000 = 15 minutes)
- `RATE_LIMIT_MAX_REQUESTS`: Maximum requests per window (default: 20)

## Rate Limiting

The API enforces rate limiting: **20 requests per minute per IP address**.

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when limit resets

## Error Handling

Errors are returned in the following format:
```json
{
  "error": "Error Type",
  "message": "Human-readable error message"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (validation error)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error
- `503`: Service Unavailable (OpenAI API issues)

## Deployment

### Railway

1. Connect your repository to Railway
2. Railway will auto-detect Python and install dependencies
3. Set environment variables in Railway dashboard
4. Deploy!

### Render

1. Create a new Web Service on Render
2. Connect your repository
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Set environment variables
6. Deploy!

### Fly.io

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Login: `fly auth login`
3. Launch: `fly launch`
4. Set secrets: `fly secrets set OPENAI_API_KEY=your-key`
5. Deploy: `fly deploy`

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app entry point
│   ├── exceptions.py        # Custom exception classes
│   ├── models/             # Pydantic models
│   │   ├── api.py          # NutritionResult model
│   │   ├── requests.py     # Request models
│   │   └── responses.py    # Response models
│   ├── routes/             # API routes
│   │   └── analyze.py      # Food analysis endpoint
│   ├── services/           # Business logic
│   │   └── openai.py       # OpenAI integration
│   ├── middleware/         # Middleware
│   │   ├── error_handler.py
│   │   └── rate_limiter.py
│   └── utils/              # Utilities
│       └── image.py        # Image processing
├── requirements.txt        # Python dependencies
├── runtime.txt            # Python version
├── Procfile               # Deployment command
├── .env.example           # Environment variables template
└── README.md              # This file
```

## Development

### Type Checking (Optional)

Install mypy for static type checking:
```bash
pip install mypy
mypy app/
```

### Testing

Install pytest:
```bash
pip install pytest pytest-asyncio httpx
```

Run tests:
```bash
pytest
```

## Troubleshooting

### OpenAI API Key Not Set

Ensure `.env` file exists and contains `OPENAI_API_KEY`. The app will fail to start if the key is missing.

### Import Errors

Make sure you're running from the `backend/` directory and have activated your virtual environment.

### Port Already in Use

Change the port in `.env` or use a different port:
```bash
uvicorn app.main:app --port 8001
```

### Rate Limiting Issues

Rate limiting is per IP address. If testing locally, you may hit limits quickly. Consider adjusting rate limits in development.
