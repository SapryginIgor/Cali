## Context

The mobile app (React Native/Expo) currently uses mock AI functionality in `lib/ai.ts` that provides rough nutritional estimates based on keyword matching. The frontend calls `generateObject()` with messages containing image URIs and optional text descriptions, expecting a `NutritionResult` interface with carbs, protein, fats, calories, and analysis.

The app is built with:
- Expo/React Native framework
- TypeScript
- Zod for validation (already used in frontend)
- Image picker capabilities (expo-image-picker)

**Constraints:**
- Must maintain compatibility with existing `generateObject()` interface signature
- Backend must handle both base64 and multipart image uploads
- API keys must never be exposed to client
- Must support future authentication without breaking changes
- Should work with common Node.js hosting platforms (Vercel, Railway, Render)

## Goals / Non-Goals

**Goals:**
- Create a secure backend proxy that protects OpenAI API keys
- Provide accurate food analysis using GPT-4 Vision
- Maintain backward compatibility with existing frontend interface
- Enable rate limiting and error handling
- Support both base64 and multipart image uploads
- Structure for future authentication integration
- Deploy to standard Node.js hosting platforms

**Non-Goals:**
- User authentication (prepared for but not implemented)
- Image storage or persistence (images processed in-memory only)
- Database or data persistence (stateless API)
- Real-time features or WebSocket support
- Multi-tenant or organization features
- Image preprocessing or optimization (pass-through to OpenAI)

## Decisions

### 1. Express.js over Fastify/NestJS
**Decision**: Use Express.js with TypeScript
**Rationale**: 
- Simpler, more lightweight for a single-purpose API
- Extensive middleware ecosystem (rate limiting, CORS, error handling)
- Easier to deploy to serverless platforms
- Lower learning curve for future maintenance
**Alternatives Considered**: Fastify (faster but smaller ecosystem), NestJS (overkill for single endpoint)

### 2. Base64 + Multipart Support
**Decision**: Support both base64 strings and multipart form data for images
**Rationale**:
- Base64: Easier for mobile apps (no FormData complexity), works well with Expo
- Multipart: More efficient for large images, standard HTTP pattern
- Frontend currently uses image URIs that can be converted to either format
**Alternatives Considered**: Base64 only (simpler but less efficient), Multipart only (more complex for mobile)

### 3. Zod for Validation
**Decision**: Use Zod for request/response validation
**Rationale**:
- Already used in frontend (`nutritionSchema`), maintains consistency
- Type-safe validation with TypeScript inference
- Can reuse same schema definitions between frontend and backend
**Alternatives Considered**: Joi (more verbose), express-validator (less type-safe)

### 4. OpenAI Structured Outputs
**Decision**: Use OpenAI's structured outputs (JSON mode) or function calling for consistent responses
**Rationale**:
- Ensures response matches `NutritionResult` interface exactly
- Reduces parsing errors and edge cases
- More reliable than prompt-based JSON extraction
**Alternatives Considered**: Prompt engineering with JSON parsing (less reliable), custom post-processing (more complex)

### 5. Rate Limiting by IP
**Decision**: Rate limit by IP address (20 requests per 15 minutes)
**Rationale**:
- Simple to implement without authentication
- Prevents abuse and cost overruns
- Can be upgraded to per-user limits when auth is added
**Alternatives Considered**: Per-user limits (requires auth), token-based (adds complexity), no limits (cost risk)

### 6. Error Handling Strategy
**Decision**: Centralized error handler middleware with user-friendly messages
**Rationale**:
- Don't expose internal errors (OpenAI API details, stack traces)
- Consistent error format across endpoints
- Easier to log and monitor errors
**Alternatives Considered**: Per-route error handling (duplication), exposing all errors (security risk)

### 7. Image Size Limit (10MB)
**Decision**: Enforce 10MB maximum image size
**Rationale**:
- Prevents memory issues and excessive API costs
- Reasonable for mobile photos (typically 2-5MB)
- OpenAI has similar limits
**Alternatives Considered**: No limit (risk), 5MB (too restrictive for high-res photos)

### 8. Frontend Integration Approach
**Decision**: Update `generateObject()` to make HTTP requests, maintain same interface
**Rationale**:
- Zero breaking changes to existing frontend code
- Can add fallback to mock if backend unavailable
- Backend URL configurable via environment variable
**Alternatives Considered**: New function (breaking change), separate service (duplication)

### 9. Deployment Platform Agnostic
**Decision**: Design for multiple hosting platforms (Vercel serverless, Railway, Render)
**Rationale**:
- Vercel: Serverless functions, good for low traffic
- Railway/Render: Traditional Node.js hosting, better for consistent workloads
- Keep deployment simple (no platform-specific code)
**Alternatives Considered**: Platform-specific optimizations (limits flexibility)

## Risks / Trade-offs

**[Risk] OpenAI API Costs** → **Mitigation**: Rate limiting (20 req/15min), image size limits, monitor usage, can add cost alerts

**[Risk] API Key Exposure** → **Mitigation**: Keys only in backend env vars, never in code or client, use environment variable management in hosting platform

**[Risk] Backend Downtime Breaks App** → **Mitigation**: Can add fallback to mock in frontend, graceful error handling

**[Risk] Image Processing Memory Issues** → **Mitigation**: 10MB size limit, process images in-memory without storage, consider streaming for very large images

**[Risk] CORS Configuration Errors** → **Mitigation**: Configure CORS for mobile app origins, test with actual mobile app, allow common Expo development URLs

**[Risk] Rate Limiting False Positives** → **Mitigation**: Reasonable limits (20/15min), can adjust per IP, will upgrade to per-user when auth added

**[Trade-off] Base64 vs Multipart** → Accept both for flexibility, but base64 adds ~33% size overhead. Trade-off: simplicity vs efficiency.

**[Trade-off] Stateless Design** → No session storage means can't track user history server-side, but simpler deployment and scaling.

## Migration Plan

### Phase 1: Backend Development
1. Create backend directory structure and TypeScript config
2. Set up Express server with middleware (CORS, error handling, rate limiting)
3. Implement `/api/analyze-food` endpoint with validation
4. Create OpenAI service with structured outputs
5. Test locally with sample images

### Phase 2: Frontend Integration
1. Add backend URL configuration (environment variable)
2. Update `lib/ai.ts` to call backend API
3. Convert image URIs to base64 for API calls
4. Add error handling and retry logic
5. Test end-to-end with mobile app

### Phase 3: Deployment
1. Deploy backend to hosting platform (Vercel/Railway/Render)
2. Configure environment variables (OPENAI_API_KEY, PORT, etc.)
3. Update frontend with production backend URL
4. Test production deployment
5. Monitor logs and error rates

### Rollback Strategy
- Frontend can revert to mock implementation by changing backend URL to empty/null
- Backend can be rolled back via hosting platform version control
- No database migrations to rollback (stateless)

## Open Questions

1. **Monitoring & Logging**: What logging service to use? (Consider: structured logging, error tracking, request metrics)
2. **Image Format Support**: Should we validate/convert image formats, or let OpenAI handle it?
3. **Request Timeout**: What timeout should we set for OpenAI API calls? (Default 30s? 60s?)
4. **Development Backend URL**: How should developers configure local backend URL? (Environment variable, config file, or hardcoded for dev?)
5. **CORS Origins**: Which specific origins should be allowed? (Expo dev server URLs, production app bundle IDs?)
