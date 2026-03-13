## 1. Parity audit and FastAPI completion

- [x] 1.1 Inventory behavior currently implemented in `backend/src/**` (request parsing, schema validation, retry/fallback, response shape) and map required parity changes in `backend/app/**`.
- [x] 1.2 Implement any missing FastAPI route/service/model behavior needed to fully satisfy current client expectations for `POST /api/analyze-food` and health/error handling.
- [x] 1.3 Add or update Python tests to verify JSON base64 and multipart request paths, validation failures, and upstream error handling.

## 2. Python-only OpenAI service path

- [x] 2.1 Ensure OpenAI request construction, structured output schema validation, and fallback logic are defined in Python service modules only.
- [x] 2.2 Remove or migrate any OpenAI-related logic that exists only in TypeScript backend files.
- [x] 2.3 Verify structured output contract fields used by clients are produced and validated by FastAPI responses.

## 3. Remove TypeScript backend runtime

- [x] 3.1 Delete `backend/src/**` TypeScript backend runtime code and related backend-only Node build/test/typecheck scripts that imply a second API implementation.
- [x] 3.2 Clean up backend package/config artifacts so local backend execution path is unambiguously Python/FastAPI.
- [x] 3.3 Validate no remaining documentation or commands instruct developers to run TypeScript backend entrypoints.

## 4. Documentation and deployment alignment

- [x] 4.1 Update backend docs to describe only Python/FastAPI architecture, setup, and runtime commands.
- [x] 4.2 Update deployment/runtime configs to point exclusively to FastAPI/Python startup paths.
- [x] 4.3 Run smoke verification from client integration path and document the migration/rollback steps.
