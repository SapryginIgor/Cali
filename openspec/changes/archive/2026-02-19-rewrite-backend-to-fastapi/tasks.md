## 1. Python Backend Setup

- [x] 1.1 Create new `backend/app/` directory structure (app/, app/routes/, app/services/, app/models/, app/middleware/, app/exceptions/)
- [x] 1.2 Create `backend/requirements.txt` with dependencies (fastapi, uvicorn[standard], openai, python-dotenv, slowapi, python-multipart, pillow, pydantic)
- [x] 1.3 Create `backend/.python-version` or `backend/runtime.txt` specifying Python 3.11
- [x] 1.4 Create `backend/.gitignore` for Python (if not exists, add __pycache__/, *.pyc, .venv/, venv/, *.egg-info/)
- [x] 1.5 Update root `.gitignore` to include Python-specific ignores
- [x] 1.6 Create `backend/.env.example` (copy from existing, ensure Python-compatible format)

## 2. Pydantic Models and Types

- [x] 2.1 Create `backend/app/models/api.py` with NutritionResult Pydantic model matching frontend interface
- [x] 2.2 Create `backend/app/models/requests.py` with AnalyzeFoodRequest Pydantic model (image: str, description: Optional[str], userId: Optional[str])
- [x] 2.3 Create `backend/app/models/responses.py` with AnalyzeFoodResponse model (extends NutritionResult) and ErrorResponse model
- [x] 2.4 Add Pydantic validators for image size (max 10MB), description length (max 500 chars), image format validation

## 3. FastAPI Application Setup

- [x] 3.1 Create `backend/app/main.py` with FastAPI app initialization
- [x] 3.2 Configure CORS middleware with same origin patterns as Express version
- [x] 3.3 Set up JSON request body size limit (11MB to account for base64 overhead)
- [x] 3.4 Configure app metadata (title, description, version)
- [x] 3.5 Add startup event to validate OPENAI_API_KEY environment variable
- [x] 3.6 Add graceful shutdown handling (SIGTERM, SIGINT)

## 4. Rate Limiting Middleware

- [x] 4.1 Install and configure slowapi library
- [x] 4.2 Create rate limiter instance with 20 requests per 15 minutes per IP
- [x] 4.3 Configure rate limiter as FastAPI dependency
- [x] 4.4 Ensure rate limit headers are included in responses (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
- [ ] 4.5 Test rate limiting returns 429 status when limit exceeded

## 5. Error Handling and Exceptions

- [x] 5.1 Create `backend/app/exceptions.py` with custom exception classes (AppError similar to Express version)
- [x] 5.2 Create `backend/app/middleware/error_handler.py` with FastAPI exception handlers
- [x] 5.3 Register exception handlers for AppError, ValidationError, OpenAI errors
- [x] 5.4 Map OpenAI API errors to appropriate HTTP status codes (401 → 500, 429 → 503, timeout → 503)
- [x] 5.5 Ensure error responses match Express version format (error, message fields)
- [x] 5.6 Add logging for errors without exposing stack traces or API keys

## 6. Analyze Food Route - Base64 JSON Support

- [x] 6.1 Create `backend/app/routes/analyze.py` with FastAPI router
- [x] 6.2 Implement POST `/api/analyze-food` endpoint accepting Pydantic AnalyzeFoodRequest model
- [x] 6.3 Extract image base64 string from request body
- [x] 6.4 Extract optional description and userId fields
- [x] 6.5 Validate image size (approximate check for base64)
- [x] 6.6 Validate description length if provided
- [x] 6.7 Call OpenAI service with image and description
- [x] 6.8 Return NutritionResult response

## 7. Analyze Food Route - Multipart Form Data Support

- [x] 7.1 Add alternative endpoint handler accepting `UploadFile` for multipart form data
- [x] 7.2 Extract image file from UploadFile
- [x] 7.3 Extract optional description from form data
- [x] 7.4 Validate file size does not exceed 10MB
- [x] 7.5 Validate file MIME type (JPEG, PNG, WebP)
- [x] 7.6 Convert UploadFile to base64 string
- [x] 7.7 Call OpenAI service with converted image
- [x] 7.8 Return NutritionResult response

## 8. OpenAI Service - Python Implementation

- [x] 8.1 Create `backend/app/services/openai.py` with OpenAI client initialization
- [x] 8.2 Initialize OpenAI client using Python SDK with API key from environment
- [x] 8.3 Implement `async def analyze_food_image(image_base64: str, description: Optional[str] = None)` function
- [x] 8.4 Format image data for OpenAI API (handle data URL prefix removal)
- [x] 8.5 Construct prompt for nutrition analysis (same as Node.js version)
- [x] 8.6 Include description in prompt when provided
- [x] 8.7 Call OpenAI API with GPT-4o model and structured JSON output
- [x] 8.8 Parse JSON response using Python json module
- [x] 8.9 Validate response matches NutritionResult schema using Pydantic
- [x] 8.10 Handle missing fields with defaults or error
- [x] 8.11 Ensure analysis text is non-empty

## 9. OpenAI Service - Error Handling

- [x] 9.1 Handle OpenAI APIError exceptions (401, 429, etc.)
- [x] 9.2 Map OpenAI errors to appropriate HTTP status codes
- [x] 9.3 Handle timeout errors (asyncio.TimeoutError or similar)
- [x] 9.4 Handle network errors (connection errors)
- [x] 9.5 Handle invalid response format errors
- [x] 9.6 Ensure API keys are never exposed in error messages
- [x] 9.7 Log detailed errors internally without exposing to client

## 10. Image Processing Utilities

- [x] 10.1 Create `backend/app/utils/image.py` with image processing utilities
- [x] 10.2 Implement function to validate image format using PIL/Pillow
- [x] 10.3 Implement function to validate image size
- [x] 10.4 Implement function to convert UploadFile to base64
- [x] 10.5 Implement function to validate base64 image format
- [x] 10.6 Handle image processing errors gracefully

## 11. Environment Configuration

- [x] 11.1 Update `backend/.env.example` with Python-compatible format
- [x] 11.2 Ensure python-dotenv loads environment variables at startup
- [x] 11.3 Validate required environment variables (OPENAI_API_KEY) at startup
- [x] 11.4 Add configuration for rate limiting (RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS)
- [x] 11.5 Add PORT configuration (default 8000 for FastAPI convention)

## 12. Testing - Local Development

- [ ] 12.1 Test FastAPI server starts successfully
- [ ] 12.2 Test analyze endpoint with valid base64 image (JSON request)
- [ ] 12.3 Test analyze endpoint with valid multipart image file
- [ ] 12.4 Test analyze endpoint with image and description
- [ ] 12.5 Test validation rejects missing image
- [ ] 12.6 Test validation rejects oversized image (>10MB)
- [ ] 12.7 Test validation rejects oversized description (>500 chars)
- [ ] 12.8 Test validation rejects invalid image format
- [ ] 12.9 Test rate limiting blocks after 20 requests
- [ ] 12.10 Test error handling for OpenAI API failures
- [ ] 12.11 Test CORS headers are present for allowed origins
- [ ] 12.12 Verify response format matches Express version exactly

## 13. Side-by-Side Testing

- [ ] 13.1 Run Node.js backend on port 3000
- [ ] 13.2 Run Python FastAPI backend on port 8000
- [ ] 13.3 Test same requests against both backends
- [ ] 13.4 Compare response formats byte-by-byte
- [ ] 13.5 Compare error response formats
- [ ] 13.6 Verify rate limiting behavior matches
- [ ] 13.7 Document any differences found

## 14. Frontend Integration Testing

- [ ] 14.1 Update `EXPO_PUBLIC_BACKEND_URL` to point to FastAPI backend (port 8000)
- [ ] 14.2 Test frontend can call FastAPI backend successfully
- [ ] 14.3 Test image conversion and upload works
- [ ] 14.4 Test error handling when backend is unavailable
- [ ] 14.5 Test end-to-end flow: take photo → analyze → display results
- [ ] 14.6 Verify nutrition data displays correctly

## 15. Deployment Configuration

- [ ] 15.1 Remove or archive `backend/vercel.json` (Node.js specific)
- [x] 15.2 Create `backend/Procfile` for Railway/Render deployment (web: uvicorn app.main:app --host 0.0.0.0 --port $PORT)
- [x] 15.3 Create `backend/runtime.txt` specifying Python version (3.11)
- [x] 15.4 Update `backend/README.md` with Python setup instructions
- [x] 15.5 Document Python deployment steps for Railway/Render/Fly.io
- [ ] 15.6 Create Dockerfile for containerized deployment (if needed)

## 16. Documentation Updates

- [x] 16.1 Update `backend/README.md` with Python/FastAPI setup instructions
- [x] 16.2 Document Python dependencies and installation
- [x] 16.3 Update API documentation examples (FastAPI auto-generates OpenAPI docs)
- [x] 16.4 Document environment variables (same as before)
- [x] 16.5 Update deployment guide for Python platforms
- [x] 16.6 Add Python-specific troubleshooting section

## 17. Migration and Cleanup

- [ ] 17.1 Archive or remove Node.js backend files (`backend/src/` TypeScript files)
- [ ] 17.2 Remove `backend/package.json`, `backend/tsconfig.json`, `backend/package-lock.json`
- [ ] 17.3 Remove `backend/node_modules/` directory
- [ ] 17.4 Update `.gitignore` to remove Node.js-specific entries (add Python ones)
- [ ] 17.5 Verify Python backend works in production-like environment
- [ ] 17.6 Update DEPLOYMENT.md with Python backend instructions

## 18. Production Deployment

- [ ] 18.1 Deploy FastAPI backend to chosen platform (Railway/Render/Fly.io)
- [ ] 18.2 Configure environment variables in deployment platform
- [ ] 18.3 Test production deployment with sample requests
- [ ] 18.4 Update frontend `EXPO_PUBLIC_BACKEND_URL` to production Python backend
- [ ] 18.5 Monitor logs and error rates
- [ ] 18.6 Keep Node.js backend available as rollback option initially
