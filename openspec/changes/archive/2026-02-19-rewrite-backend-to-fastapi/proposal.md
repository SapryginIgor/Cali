## Why

The current backend is implemented in Node.js/Express/TypeScript, but Python is more comfortable for ML workloads and provides better ecosystem support for future ML features. FastAPI offers excellent performance, automatic API documentation, type safety with Pydantic, and seamless integration with Python ML libraries. This rewrite maintains the same API contract while improving developer experience and ML integration capabilities.

## What Changes

- **Backend Technology Migration**: Replace Node.js/Express/TypeScript backend with Python/FastAPI implementation
- **Same API Contract**: Maintain identical REST API endpoints (`POST /api/analyze-food`) with same request/response formats
- **Python OpenAI SDK**: Migrate from Node.js OpenAI SDK to Python `openai` library
- **FastAPI Features**: Leverage FastAPI's automatic OpenAPI docs, Pydantic validation, async support, and dependency injection
- **Deployment Updates**: Update deployment configuration for Python runtime (requirements.txt, Python-specific hosting)
- **Development Tooling**: Replace npm/TypeScript tooling with Python tooling (pip, virtualenv, mypy optional)

**BREAKING**: Backend runtime changes from Node.js to Python - requires different deployment environment and dependencies.

## Capabilities

### New Capabilities
<!-- No new capabilities - same API contract -->

### Modified Capabilities
- `food-analysis-api`: Implementation technology changes from Express/TypeScript to FastAPI/Python. API contract, endpoints, request/response formats, and validation requirements remain identical. FastAPI-specific implementation details (Pydantic models, async handlers, dependency injection) replace Express middleware patterns.
- `openai-proxy-service`: Implementation changes from Node.js OpenAI SDK to Python OpenAI SDK. Same functionality (GPT-4 Vision integration, structured outputs, error handling) but using Python library and async/await patterns native to FastAPI.

## Impact

**Removed Dependencies**:
- Node.js runtime and npm packages
- Express, TypeScript, tsx, and related Node.js tooling
- Node.js OpenAI SDK

**New Dependencies**:
- Python 3.9+ runtime
- FastAPI web framework
- Python OpenAI SDK
- Pydantic for validation (built into FastAPI)
- Uvicorn or Gunicorn ASGI server
- Python image processing libraries (Pillow, base64)

**Code Changes**:
- Replace `backend/src/` TypeScript files with Python equivalents (`backend/app/` or `backend/src/`)
- Convert Express routes to FastAPI route handlers
- Convert Express middleware to FastAPI dependencies/middleware
- Replace Zod schemas with Pydantic models
- Update error handling to FastAPI exception handlers
- Convert rate limiting from express-rate-limit to slowapi or custom implementation

**Infrastructure**:
- Update deployment configs (remove vercel.json, update for Python hosting)
- Change build process (no TypeScript compilation, use Python directly)
- Update environment variable loading (python-dotenv instead of dotenv)
- Update Dockerfile if containerized (Python base image instead of Node)

**Frontend**:
- No changes required - API contract remains identical
- Same `EXPO_PUBLIC_BACKEND_URL` configuration

**Deployment Platforms**:
- Vercel: Update to use Python runtime
- Railway: Update build/start commands for Python
- Render: Update to Python environment
- Alternative: Consider Python-specific platforms (Fly.io, PythonAnywhere, Heroku)
