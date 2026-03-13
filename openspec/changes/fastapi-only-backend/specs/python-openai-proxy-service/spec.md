## ADDED Requirements

### Requirement: OpenAI requests are executed by Python services only
The backend MUST execute OpenAI model requests exclusively through Python/FastAPI service code.

#### Scenario: Analyze-food request reaches AI layer
- **WHEN** `/api/analyze-food` processing requires model inference
- **THEN** the request is handled by Python service modules and not by TypeScript runtime code

### Requirement: Structured output is validated in Python
The backend MUST validate model output against a Python-defined structured schema before returning or persisting data.

#### Scenario: Valid structured output
- **WHEN** model output conforms to required schema
- **THEN** the backend returns the parsed structured response

#### Scenario: Invalid structured output
- **WHEN** model output is malformed or missing required fields
- **THEN** the backend applies defined retry/fallback/error behavior and does not emit invalid structured data
