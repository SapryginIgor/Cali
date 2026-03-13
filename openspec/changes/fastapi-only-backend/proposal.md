## Why

The repository currently contains two backend implementations (Python/FastAPI and TypeScript/Express), which creates ambiguity about the production path and causes behavior drift between stacks. We need a single backend implementation so API behavior, OpenAI integration, deployment, and maintenance are deterministic.

## What Changes

- Consolidate backend runtime to Python/FastAPI only, including OpenAI request/response handling in Python services.
- Remove TypeScript/Express backend source, scripts, and unused Node-specific backend artifacts that duplicate API behavior.
- Ensure `POST /api/analyze-food` and related health/rate-limit/error behavior are fully implemented and validated in FastAPI.
- Align project documentation and deployment paths to a single backend stack.
- **BREAKING**: Node/Express backend entrypoints and Node backend scripts are removed; all backend development/deployment must use Python/FastAPI paths.

## Capabilities

### New Capabilities
- `backend-runtime-consolidation`: Enforce a single Python/FastAPI backend implementation and remove parallel TypeScript backend runtime.
- `python-food-analysis-api`: Define Python/FastAPI as the only supported runtime for food analysis API behavior.
- `python-openai-proxy-service`: Define Python-only OpenAI request handling and structured output validation.

### Modified Capabilities
- None.

## Impact

- Affected code: `backend/src/**` removal/migration, FastAPI route/service/model updates under `backend/app/**`, backend scripts and config cleanup.
- Affected data/API surface: API endpoints should remain stable for clients, but backend runtime/tooling is now Python-only.
- Dependencies/systems: deployment tooling (Docker/Procfile/commands), local developer workflow, and CI checks need to target Python backend only.
