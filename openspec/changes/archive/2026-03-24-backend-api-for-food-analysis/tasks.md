## 1. Backend Setup

- [x] 1.1 Create `backend/` directory structure (src/, src/routes/, src/services/, src/middleware/, src/types/, src/utils/)
- [x] 1.2 Create `backend/package.json` with dependencies (express, @types/express, openai, dotenv, express-rate-limit, multer, cors, zod, typescript)
- [x] 1.3 Create `backend/tsconfig.json` with TypeScript configuration for Node.js
- [x] 1.4 Create `backend/.env.example` with environment variable template (PORT, OPENAI_API_KEY, NODE_ENV, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS)
- [x] 1.5 Create `backend/.gitignore` to exclude node_modules/, dist/, .env files
- [x] 1.6 Update root `.gitignore` to include backend build artifacts and .env files

## 2. Type Definitions

- [x] 2.1 Create `backend/src/types/api.ts` with NutritionResult interface matching frontend
- [x] 2.2 Add request types for analyze-food endpoint (base64 and multipart variants)
- [x] 2.3 Add response types and error response types
- [x] 2.4 Create Zod schemas for request validation (image, description, userId)

## 3. Express Server Setup

- [x] 3.1 Create `backend/src/index.ts` with Express app initialization
- [x] 3.2 Configure CORS middleware with appropriate origins (mobile app, Expo dev servers)
- [x] 3.3 Add JSON body parser middleware
- [x] 3.4 Add error handling middleware (create `backend/src/middleware/errorHandler.ts`)
- [x] 3.5 Add rate limiting middleware (create `backend/src/middleware/rateLimiter.ts` with 20 requests per 15 minutes)
- [x] 3.6 Mount routes (analyze route)
- [x] 3.7 Configure server port from environment variable (default 3000)
- [x] 3.8 Add graceful shutdown handling
- [x] 3.9 Add startup logging

## 4. Rate Limiting Middleware

- [x] 4.1 Implement `backend/src/middleware/rateLimiter.ts` using express-rate-limit
- [x] 4.2 Configure rate limit: 20 requests per 15 minutes per IP
- [x] 4.3 Add rate limit headers to responses (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
- [x] 4.4 Return 429 status with appropriate message when limit exceeded

## 5. Error Handling Middleware

- [x] 5.1 Implement `backend/src/middleware/errorHandler.ts` as centralized error handler
- [x] 5.2 Catch all errors and return user-friendly messages
- [x] 5.3 Log detailed errors internally without exposing to client
- [x] 5.4 Handle different error types (validation, OpenAI API, network, timeout)
- [x] 5.5 Map OpenAI API errors to appropriate HTTP status codes (401 → 500, 429 → 503, timeout → 503)

## 6. Analyze Food Endpoint - Request Handling

- [x] 7.1 Create `backend/src/routes/analyze.ts` with POST `/api/analyze-food` route handler
- [x] 7.2 Add middleware to handle both base64 JSON and multipart form data
- [x] 7.3 Extract image from request (base64 string or multipart file)
- [x] 7.4 Extract optional description field from request
- [x] 7.5 Extract optional userId or Authorization header for future auth support

## 7. Analyze Food Endpoint - Validation

- [x] 8.1 Validate image field is present (required)
- [x] 8.2 Validate image size does not exceed 10MB
- [x] 8.3 Validate image format is supported (JPEG, PNG, WebP)
- [x] 8.4 Validate description length does not exceed 500 characters (if provided)
- [x] 8.5 Return 400 Bad Request with specific error message for validation failures
- [x] 8.6 Use Zod schemas for validation

## 8. Analyze Food Endpoint - Image Processing

- [x] 9.1 Convert multipart file to base64 if needed
- [x] 9.2 Validate base64 image format
- [x] 9.3 Ensure image data is properly formatted for OpenAI API (data URL or base64 string)
- [x] 9.4 Handle image processing errors gracefully

## 9. OpenAI Service - Client Setup

- [x] 10.1 Create `backend/src/services/openai.ts` with OpenAI client initialization
- [x] 10.2 Initialize OpenAI client with API key from `OPENAI_API_KEY` environment variable
- [x] 10.3 Add validation to ensure API key is present at startup
- [x] 10.4 Log error and fail startup if API key is missing

## 10. OpenAI Service - Analysis Function

- [x] 11.1 Implement `analyzeFoodImage(imageBase64: string, description?: string)` function
- [x] 11.2 Construct prompt for nutrition analysis with image analysis instruction
- [x] 11.3 Include description as additional context in prompt when provided
- [x] 11.4 Format image data according to OpenAI Vision API requirements
- [x] 11.5 Call OpenAI API with GPT-4 Vision model (gpt-4-vision-preview or gpt-4o)

## 11. OpenAI Service - Structured Outputs

- [x] 12.1 Configure OpenAI API call to use structured outputs or function calling
- [x] 12.2 Define response schema matching NutritionResult interface (carbs, protein, fats, calories as numbers, analysis as string)
- [x] 12.3 Ensure response format matches expected schema
- [x] 12.4 Parse and validate OpenAI response

## 12. OpenAI Service - Error Handling

- [x] 13.1 Handle OpenAI API authentication errors (401) - log and return 500
- [x] 13.2 Handle OpenAI API rate limit errors (429) - log and return 503
- [x] 13.3 Handle OpenAI API timeout (60 seconds) - log and return 503
- [x] 13.4 Handle network errors - log and return 503
- [x] 13.5 Handle invalid response format - log, attempt recovery, or return 500
- [x] 13.6 Ensure API keys are never exposed in error messages

## 13. Analyze Food Endpoint - Response

- [x] 14.1 Call OpenAI service with processed image and description
- [x] 14.2 Validate response matches NutritionResult interface
- [x] 14.3 Handle missing fields in response (log warning, use defaults if possible)
- [x] 14.4 Handle invalid field types (attempt conversion, log warning)
- [x] 14.5 Ensure analysis text is non-empty and properly formatted
- [x] 14.6 Return 200 OK with JSON body containing nutrition data

## 14. Frontend Integration - Configuration

- [x] 15.1 Add backend URL configuration (environment variable or config file)
- [x] 15.2 Create config helper to get backend URL (with fallback for development)
- [x] 15.3 Document how to configure backend URL for development and production

## 15. Frontend Integration - API Client

- [x] 16.1 Update `lib/ai.ts` to add function for calling backend API
- [x] 16.2 Implement image URI to base64 conversion utility
- [x] 16.3 Create HTTP client function that sends POST request to `/api/analyze-food`
- [x] 16.4 Format request body with base64 image and optional description
- [x] 16.5 Handle response parsing and validation
- [x] 16.6 Add error handling and retry logic

## 16. Frontend Integration - Update generateObject

- [x] 17.1 Update `generateObject()` function to call backend API instead of mock
- [x] 17.2 Extract image URI from messages array
- [x] 17.3 Extract description from messages array
- [x] 17.4 Convert image URI to base64 format
- [x] 17.5 Call backend API with converted data
- [x] 17.6 Maintain same return type and interface signature (backward compatible)
- [x] 17.7 Add fallback to mock implementation if backend URL is not configured

## 17. Testing - Backend

- [ ] 17.1 Test analyze endpoint with valid base64 image
- [ ] 17.2 Test analyze endpoint with valid multipart image
- [ ] 17.3 Test analyze endpoint with image and description
- [ ] 17.4 Test validation rejects missing image
- [ ] 17.5 Test validation rejects oversized image (>10MB)
- [ ] 17.6 Test validation rejects oversized description (>500 chars)
- [ ] 17.7 Test rate limiting blocks after 20 requests
- [ ] 17.8 Test error handling for OpenAI API failures
- [ ] 17.9 Test CORS headers are present for allowed origins

## 18. Testing - Frontend Integration

- [ ] 18.1 Test frontend can call backend API successfully
- [ ] 18.2 Test image conversion from URI to base64 works correctly
- [ ] 18.3 Test error handling when backend is unavailable
- [ ] 18.4 Test fallback to mock when backend URL is not configured
- [ ] 18.5 Test end-to-end flow: take photo → analyze → display results

## 19. Documentation

- [x] 19.1 Create `backend/README.md` with setup instructions
- [x] 19.2 Document environment variables and configuration
- [x] 19.3 Document API endpoint usage with example requests
- [x] 19.4 Include example curl commands for testing
- [x] 19.5 Document deployment steps for Vercel/Railway/Render
- [x] 19.6 Document frontend configuration for backend URL

## 20. Deployment Preparation

- [ ] 20.1 Test backend locally with sample images
- [ ] 20.2 Verify all environment variables are documented
- [ ] 20.3 Create deployment configuration files if needed (vercel.json, railway.json, etc.)
- [ ] 20.4 Test production build process
