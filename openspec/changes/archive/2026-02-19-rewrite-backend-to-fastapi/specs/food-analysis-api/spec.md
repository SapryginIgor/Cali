## MODIFIED Requirements

**Note**: All requirements remain identical - same API contract, endpoints, validation, and responses. Implementation technology changes from Express/TypeScript to FastAPI/Python. FastAPI-specific implementation details: Pydantic models for validation, async route handlers, FastAPI exception handlers, slowapi for rate limiting.

### Requirement: API endpoint accepts food analysis requests
The system SHALL provide a `POST /api/analyze-food` endpoint that accepts food images and optional text descriptions for nutritional analysis.

**Implementation**: FastAPI route handler using `@app.post("/api/analyze-food")` with async function. Supports both Pydantic model (base64 JSON) and `UploadFile` (multipart).

#### Scenario: Request with base64 image
- **WHEN** client sends POST request to `/api/analyze-food` with `image` field containing base64-encoded image string and optional `description` field
- **THEN** system validates the request using Pydantic model, processes the image, and returns nutrition data in JSON format

#### Scenario: Request with multipart form data
- **WHEN** client sends POST request to `/api/analyze-food` with multipart form data containing image file and optional `description` field
- **THEN** system validates the request using FastAPI `UploadFile`, processes the image, and returns nutrition data in JSON format

#### Scenario: Request with image only
- **WHEN** client sends POST request to `/api/analyze-food` with only an image (no description)
- **THEN** system processes the image and returns nutrition data

### Requirement: Request validation
The system SHALL validate all incoming requests before processing.

**Implementation**: Pydantic models for request validation (replaces Zod schemas). FastAPI automatically validates request bodies against Pydantic models and returns 422 for validation errors.

#### Scenario: Valid request passes validation
- **WHEN** request contains valid image (base64 or multipart) and optional description string
- **THEN** validation passes via Pydantic and request proceeds to processing

#### Scenario: Missing image is rejected
- **WHEN** request does not contain an image field
- **THEN** system returns 400 Bad Request (or 422 Unprocessable Entity from Pydantic) with error message indicating image is required

#### Scenario: Invalid image format is rejected
- **WHEN** request contains image data that cannot be parsed or is not a valid image format
- **THEN** system returns 400 Bad Request with error message

#### Scenario: Image exceeds size limit is rejected
- **WHEN** request contains image larger than 10MB
- **THEN** system returns 400 Bad Request with error message indicating size limit exceeded

#### Scenario: Description exceeds length limit is rejected
- **WHEN** request contains description field longer than 500 characters
- **THEN** system returns 400 Bad Request with error message indicating description too long

### Requirement: Response format matches NutritionResult interface
The system SHALL return responses in JSON format matching the `NutritionResult` interface with fields: carbs, protein, fats, calories, and analysis.

**Implementation**: Pydantic response model ensures correct JSON serialization. FastAPI automatically serializes Pydantic models to JSON.

#### Scenario: Successful response structure
- **WHEN** food analysis completes successfully
- **THEN** system returns 200 OK with JSON body containing numeric fields (carbs, protein, fats, calories) and string field (analysis)

#### Scenario: Response data types are correct
- **WHEN** food analysis completes successfully
- **THEN** carbs, protein, fats, and calories are numbers, and analysis is a non-empty string

### Requirement: Rate limiting prevents abuse
The system SHALL enforce rate limits to prevent excessive API usage.

**Implementation**: slowapi library (FastAPI port of Flask-Limiter) configured as dependency injection. Same limits: 20 requests per 15 minutes per IP.

#### Scenario: Request within rate limit succeeds
- **WHEN** client makes request and has not exceeded 20 requests in the past 15 minutes
- **THEN** request is processed normally

#### Scenario: Request exceeding rate limit is rejected
- **WHEN** client makes request after exceeding 20 requests in the past 15 minutes
- **THEN** system returns 429 Too Many Requests with rate limit headers indicating when limit resets

#### Scenario: Rate limit headers are included
- **WHEN** client makes any request
- **THEN** response includes rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)

### Requirement: Error handling provides user-friendly messages
The system SHALL handle errors gracefully and return user-friendly error messages without exposing internal details.

**Implementation**: FastAPI exception handlers using `@app.exception_handler()` decorator. Custom exception classes (similar to AppError) raised and handled centrally.

#### Scenario: Internal error does not expose details
- **WHEN** an internal server error occurs (e.g., OpenAI API failure)
- **THEN** system returns 500 Internal Server Error with generic message, logs detailed error internally, and does not expose stack traces or API keys

#### Scenario: Validation error provides specific message
- **WHEN** request validation fails (Pydantic validation error)
- **THEN** system returns 400 Bad Request (or 422) with specific message indicating what validation failed

#### Scenario: Service unavailable error is handled
- **WHEN** OpenAI service is unavailable or times out
- **THEN** system returns 503 Service Unavailable with message indicating service is temporarily unavailable

### Requirement: CORS allows mobile app origins
The system SHALL configure CORS to allow requests from mobile app origins.

**Implementation**: FastAPI CORSMiddleware configured with same origin patterns as Express version.

#### Scenario: Request from allowed origin succeeds
- **WHEN** request includes Origin header matching configured allowed origins
- **THEN** response includes appropriate CORS headers and request is processed

#### Scenario: Request from disallowed origin is blocked
- **WHEN** request includes Origin header not matching configured allowed origins
- **THEN** CORS middleware blocks the request before processing

### Requirement: Optional user identifier support
The system SHALL accept optional user identifier in requests for future authentication support.

**Implementation**: Optional field in Pydantic request model or extracted from Authorization header. Same behavior as Express version.

#### Scenario: Request with user identifier is accepted
- **WHEN** request includes optional `userId` field or `Authorization` header
- **THEN** system accepts the request and may log the identifier for analytics, but does not require authentication

#### Scenario: Request without user identifier is accepted
- **WHEN** request does not include user identifier
- **THEN** system accepts and processes the request normally
