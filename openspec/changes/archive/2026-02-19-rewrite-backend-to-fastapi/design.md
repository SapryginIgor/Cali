## Context

The current backend is implemented in Node.js/Express/TypeScript with the following structure:
- Express server with CORS, JSON parsing, rate limiting middleware
- Single route: `POST /api/analyze-food` handling both base64 JSON and multipart form data
- OpenAI service using Node.js SDK with GPT-4 Vision
- Rate limiting: 20 requests per 15 minutes per IP using `express-rate-limit`
- Error handling: Centralized middleware with user-friendly messages
- Validation: Zod schemas matching frontend interfaces
- Environment: dotenv for configuration, TypeScript compilation

The frontend expects the same API contract (same endpoints, request/response formats) and is already configured to call the backend via `EXPO_PUBLIC_BACKEND_URL`.

**Constraints:**
- Must maintain identical API contract (no breaking changes for frontend)
- Same request/response formats (base64 JSON or multipart)
- Same error response structure
- Same rate limiting behavior (20/15min per IP)
- Same CORS configuration for mobile apps
- Must support same deployment platforms or equivalent Python alternatives

## Goals / Non-Goals

**Goals:**
- Migrate backend to Python/FastAPI for better ML ecosystem integration
- Maintain 100% API compatibility with existing Express implementation
- Leverage FastAPI features: automatic OpenAPI docs, Pydantic validation, async support
- Improve developer experience with Python's ML-friendly tooling
- Enable future ML feature additions (image preprocessing, custom models, etc.)
- Maintain same security posture (API key protection, rate limiting, input validation)

**Non-Goals:**
- Changing API contract or endpoints
- Adding new features beyond technology migration
- Changing frontend code (frontend remains unchanged)
- Database or persistence layer (remains stateless)
- Authentication features (prepared for but not implemented)

## Decisions

### 1. FastAPI over Flask/Django/Other Python Frameworks
**Decision**: Use FastAPI
**Rationale**:
- Modern async/await support (better for I/O-bound OpenAI API calls)
- Automatic OpenAPI/Swagger documentation (built-in, no extra setup)
- Pydantic integration for type-safe validation (similar to Zod in TypeScript)
- High performance (comparable to Node.js, faster than Flask)
- Excellent for API-first development
- Growing ecosystem with good ML library integration
**Alternatives Considered**: Flask (simpler but synchronous, less type safety), Django (overkill for single endpoint), Starlette (lower-level, FastAPI is built on it)

### 2. ASGI Server: Uvicorn over Gunicorn
**Decision**: Use Uvicorn for development and production
**Rationale**:
- Native ASGI support (required for FastAPI)
- Built-in async support
- Simple single-process deployment for small scale
- Easy to run: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
**Alternatives Considered**: Gunicorn with Uvicorn workers (better for production scale, but adds complexity), Hypercorn (alternative ASGI server)

### 3. Rate Limiting: slowapi over Custom Implementation
**Decision**: Use `slowapi` library (FastAPI port of Flask-Limiter)
**Rationale**:
- Proven library specifically designed for FastAPI
- Similar API to express-rate-limit (easy migration)
- Supports IP-based rate limiting out of the box
- Can be configured as dependency injection (FastAPI pattern)
**Alternatives Considered**: Custom implementation (more work), redis-based (overkill for single endpoint), fastapi-limiter (less mature)

### 4. Request Validation: Pydantic Models over Manual Validation
**Decision**: Use Pydantic models for request/response validation
**Rationale**:
- Built into FastAPI (automatic validation and serialization)
- Type-safe with Python type hints
- Automatic OpenAPI schema generation
- Similar to Zod schemas (easy mental mapping)
- Better error messages than manual validation
**Alternatives Considered**: Manual validation (more code, less type safety), marshmallow (more verbose)

### 5. Image Handling: FastAPI UploadFile + base64 Support
**Decision**: Support both multipart (UploadFile) and base64 JSON (Pydantic model)
**Rationale**:
- FastAPI's `UploadFile` handles multipart efficiently
- Base64 can be handled via Pydantic `BaseModel` with string field
- Maintains compatibility with existing frontend (uses base64)
- Python's `base64` and `PIL` libraries handle image processing well
**Alternatives Considered**: Base64 only (simpler but less flexible), Multipart only (breaks frontend compatibility)

### 6. Error Handling: FastAPI Exception Handlers over Middleware
**Decision**: Use FastAPI's exception handler system
**Rationale**:
- FastAPI's native pattern (more idiomatic than middleware)
- Can create custom exception classes (similar to AppError)
- Centralized handlers via `@app.exception_handler()`
- Cleaner than Express middleware pattern
**Alternatives Considered**: Middleware approach (works but less idiomatic), per-route try/catch (duplication)

### 7. OpenAI SDK: Python openai Library
**Decision**: Use official Python `openai` library
**Rationale**:
- Official SDK maintained by OpenAI
- Async support (`await client.chat.completions.create()`)
- Same API patterns as Node.js SDK (easy migration)
- Supports structured outputs (response_format)
- Well-documented and stable
**Alternatives Considered**: Custom HTTP client (more work, less reliable), other OpenAI wrappers (less official)

### 8. Environment Variables: python-dotenv over os.environ
**Decision**: Use `python-dotenv` for .env file loading
**Rationale**:
- Standard Python pattern (equivalent to Node.js dotenv)
- Loads `.env` file automatically
- Can be used with Pydantic Settings for type-safe config
- Familiar pattern for developers
**Alternatives Considered**: os.environ only (no .env file support), pydantic-settings (more complex, good for larger apps)

### 9. Project Structure: app/ Directory over src/
**Decision**: Use `backend/app/` directory structure
**Rationale**:
- Common FastAPI convention
- Clear separation: `app/main.py` (entry), `app/routes/`, `app/services/`, `app/models/`
- Matches Python package conventions
- Easy to import: `from app.services.openai import analyze_food_image`
**Alternatives Considered**: `src/` (works but less common), flat structure (harder to organize)

### 10. Deployment: Python Runtime Platforms
**Decision**: Support Railway, Render, Fly.io (Python-native platforms)
**Rationale**:
- Railway: Excellent Python support, automatic detection
- Render: Good Python runtime, easy setup
- Fly.io: Great for Python apps, good performance
- Vercel: Supports Python but less ideal for long-running processes
**Alternatives Considered**: Vercel (works but serverless model less ideal), Heroku (deprecated free tier), AWS/GCP (more complex)

## Risks / Trade-offs

**[Risk] Migration Complexity** → **Mitigation**: Maintain same API contract, test side-by-side, gradual rollout possible

**[Risk] Deployment Platform Changes** → **Mitigation**: Choose platforms with good Python support, document migration steps, can run both backends temporarily

**[Risk] Performance Differences** → **Mitigation**: FastAPI performance is comparable to Express, async patterns may improve I/O-bound operations

**[Risk] Developer Learning Curve** → **Mitigation**: FastAPI is Pythonic and well-documented, similar patterns to Express

**[Risk] Package Management** → **Mitigation**: Use `requirements.txt` (standard), consider `poetry` or `pipenv` for better dependency management

**[Risk] Type Safety Loss** → **Mitigation**: Use Pydantic + Python type hints, mypy for static checking (optional)

**[Trade-off] Node.js Ecosystem vs Python ML Ecosystem** → Trade-off: Lose npm ecosystem but gain Python ML libraries (NumPy, PIL, scikit-learn, etc.)

**[Trade-off] Deployment Simplicity** → Node.js deployments are well-established, but Python platforms (Railway, Render) are equally simple

**[Risk] CORS Configuration** → **Mitigation**: FastAPI CORS middleware similar to Express, same configuration needed

**[Risk] Rate Limiting Implementation** → **Mitigation**: slowapi provides similar functionality, test thoroughly

## Migration Plan

### Phase 1: Python Backend Development
1. Create new Python backend structure (`backend/app/` directory)
2. Set up FastAPI app with CORS, middleware, exception handlers
3. Implement `/api/analyze-food` endpoint with Pydantic models
4. Port OpenAI service to Python SDK
5. Implement rate limiting with slowapi
6. Add error handling with FastAPI exception handlers
7. Test locally with same test cases as Node.js version

### Phase 2: Side-by-Side Testing
1. Run both Node.js and Python backends on different ports
2. Test Python backend with same curl commands
3. Verify response formats match exactly
4. Test error cases (validation, rate limiting, OpenAI failures)
5. Performance comparison (optional)

### Phase 3: Frontend Integration
1. Update `EXPO_PUBLIC_BACKEND_URL` to point to Python backend
2. Test end-to-end with mobile app
3. Verify all flows work identically
4. Monitor for any differences in behavior

### Phase 4: Deployment
1. Deploy Python backend to chosen platform (Railway/Render/Fly.io)
2. Configure environment variables (OPENAI_API_KEY, etc.)
3. Update frontend with production Python backend URL
4. Monitor logs and error rates
5. Keep Node.js backend as backup for rollback

### Rollback Strategy
- Frontend can switch `EXPO_PUBLIC_BACKEND_URL` back to Node.js backend instantly
- Both backends can run simultaneously during transition
- No database migrations to rollback (stateless)
- Can deploy Python backend to different URL, test, then switch

## Open Questions

1. **Python Version**: Use Python 3.9, 3.10, or 3.11? (Recommend 3.11 for best performance)
2. **Dependency Management**: Use `requirements.txt` or `pyproject.toml` with Poetry? (Start with requirements.txt for simplicity)
3. **Type Checking**: Use mypy for static type checking? (Optional but recommended)
4. **Image Processing**: Use PIL/Pillow for validation or rely on OpenAI? (Use PIL for size/format validation)
5. **Logging**: Use Python's logging module or structured logging library? (Start with logging, add structured later if needed)
6. **Testing**: Use pytest or unittest? (pytest is more common for FastAPI)
7. **Docker**: Create Dockerfile for containerized deployment? (Yes, for flexibility)
