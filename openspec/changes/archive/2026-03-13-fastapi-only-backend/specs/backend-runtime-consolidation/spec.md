## ADDED Requirements

### Requirement: Backend runtime is Python/FastAPI only
The repository MUST define Python/FastAPI as the only supported backend runtime for API execution.

#### Scenario: Runtime source of truth is unambiguous
- **WHEN** a contributor inspects backend runtime entrypoints
- **THEN** only Python/FastAPI backend execution paths are present for API serving

#### Scenario: Deprecated TypeScript backend runtime is removed
- **WHEN** backend source directories and runtime scripts are reviewed
- **THEN** TypeScript/Express backend runtime code and entrypoint scripts are not present

### Requirement: Operational documentation references one backend stack
Project backend documentation MUST reference only Python/FastAPI runtime commands and architecture.

#### Scenario: Developer follows backend setup instructions
- **WHEN** a developer uses backend README/setup/deploy instructions
- **THEN** instructions consistently point to Python/FastAPI commands and files only
