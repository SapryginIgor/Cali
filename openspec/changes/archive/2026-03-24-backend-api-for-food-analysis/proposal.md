## Why

The mobile app currently uses mock AI functionality that provides rough nutritional estimates based on simple keyword matching. To provide accurate, real-world food analysis, we need to integrate with OpenAI's GPT-4 Vision API. However, exposing API keys directly in the mobile app is a security risk. A backend API proxy will securely handle OpenAI integration, protect API keys, and enable future features like authentication, rate limiting, and analytics.

## What Changes

- **New Backend Service**: Create a Node.js/Express TypeScript backend server that proxies food analysis requests to OpenAI GPT-4 Vision API
- **API Endpoint**: Add `POST /api/analyze-food` endpoint that accepts image uploads (base64 or multipart) and optional text descriptions
- **OpenAI Integration**: Implement service layer that calls OpenAI's vision API with structured prompts to extract nutrition data
- **Security & Reliability**: Add rate limiting, error handling middleware, input validation, and CORS configuration
- **Frontend Integration**: Update `lib/ai.ts` to call the backend API instead of mock implementation
- **Infrastructure**: Add backend directory structure, TypeScript configuration, environment variable management, and deployment documentation

## Capabilities

### New Capabilities
- `food-analysis-api`: REST API endpoint that accepts food images and returns structured nutrition data (carbs, protein, fats, calories, analysis). Handles image uploads, validates requests, and returns consistent JSON responses matching the frontend `NutritionResult` interface.
- `openai-proxy-service`: Service layer that securely proxies requests to OpenAI GPT-4 Vision API. Manages API key storage, constructs vision prompts, handles structured outputs, and provides error handling for OpenAI API failures.

### Modified Capabilities
<!-- No existing capabilities are being modified - this is a new backend service that doesn't change existing spec requirements -->

## Impact

**New Dependencies**: 
- Backend Express server with TypeScript
- OpenAI SDK for Node.js
- Image processing libraries (multer/busboy)
- Rate limiting middleware
- CORS middleware
- Validation libraries (zod)

**Code Changes**:
- New `backend/` directory with Express server, routes, services, middleware, and types
- Update `lib/ai.ts` to make HTTP requests to backend API instead of mock implementation
- Add backend URL configuration (environment variable or config)

**Infrastructure**:
- Backend server deployment (Vercel, Railway, Render, or similar)
- Environment variable management for API keys

**Security**:
- API keys moved from client to server-side only
- Rate limiting prevents abuse
- Input validation on all requests
- CORS configured for mobile app origins
