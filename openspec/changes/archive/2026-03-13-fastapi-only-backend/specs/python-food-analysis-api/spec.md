## ADDED Requirements

### Requirement: FastAPI serves the food analysis API contract
The Python/FastAPI backend MUST serve `POST /api/analyze-food` with behavior compatible with current clients.

#### Scenario: JSON base64 request is accepted
- **WHEN** a client sends JSON with base64 `image` and optional `description`
- **THEN** FastAPI validates the payload and returns a structured nutrition response

#### Scenario: Multipart image request is accepted
- **WHEN** a client sends multipart form data with an image file and optional fields
- **THEN** FastAPI validates media constraints and returns a structured nutrition response

### Requirement: Error and validation handling is deterministic
The FastAPI backend MUST return predictable validation and service error responses for invalid input and upstream failures.

#### Scenario: Invalid request payload
- **WHEN** required fields are missing or invalid
- **THEN** the API returns a validation error response without calling OpenAI

#### Scenario: Upstream AI failure
- **WHEN** OpenAI call fails or times out
- **THEN** the API returns a service error response consistent with backend error policy
