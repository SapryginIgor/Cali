## Context

The codebase currently has two backend implementations under `backend/`: a Python/FastAPI stack in `app/` and a TypeScript/Express stack in `src/`. This duplication has already caused confusion about which runtime is authoritative for OpenAI calls, validation contracts, tests, and deployment, increasing regression risk and maintenance cost.

## Goals / Non-Goals

**Goals:**
- Establish Python/FastAPI as the only backend runtime.
- Ensure OpenAI calls and structured output validation are handled only in Python services.
- Preserve client-visible API behavior for `POST /api/analyze-food` and health checks.
- Remove TypeScript backend sources and scripts that create dual-path ambiguity.
- Align docs, deployment, and developer workflow to Python-only backend operations.

**Non-Goals:**
- Redesign mobile app features or data model beyond backend parity.
- Introduce new endpoint families unrelated to current food analysis API.
- Change product-level nutrition logic beyond parity/compatibility needs.

## Decisions

- **Decision: Treat FastAPI `backend/app/**` as the single source of truth.**  
  All backend behavior and future changes must land in Python only.  
  **Rationale:** Eliminates duplicate implementation drift and review ambiguity.  
  **Alternative considered:** Keep both runtimes and enforce parity with tests; rejected due to ongoing coordination overhead.

- **Decision: Remove TypeScript backend tree and Node backend scripts from `backend/package.json`.**  
  Delete `backend/src/**` and references to TS test/build commands.  
  **Rationale:** Prevents accidental execution of deprecated runtime and reduces cognitive load.  
  **Alternative considered:** Keep TS code archived but inactive; rejected because stale code still causes mistaken edits.

- **Decision: Preserve API contract and migrate missing behavior into FastAPI before deletion.**  
  Confirm request formats (JSON base64 + multipart), structured response fields, and validation/fallback behavior in Python.  
  **Rationale:** Consolidation should not break frontend integration.  
  **Alternative considered:** Accept API drift during migration; rejected due to user-facing regression risk.

- **Decision: Consolidate backend docs/deployment to Python path only.**  
  Update README, compose/deploy notes, and commands to remove conflicting Node instructions.  
  **Rationale:** Documentation must enforce one operational path.  
  **Alternative considered:** Keep historical multi-runtime docs; rejected because it perpetuates confusion.

## Risks / Trade-offs

- **[Behavior mismatch during migration]** Python implementation may miss edge-case behavior present in TS backend.  
  **Mitigation:** Add parity-focused tests for request parsing, validation, and fallback responses before removing TS.

- **[Accidental breakage of local workflows]** Contributors may rely on existing Node scripts.  
  **Mitigation:** Provide explicit migration notes and replacement Python commands.

- **[Deployment misconfiguration]** Existing deploy configs might still point to Node entrypoints.  
  **Mitigation:** Audit and update deployment artifacts in same change; verify with smoke tests.

## Migration Plan

1. Inventory endpoint behavior implemented in `backend/src/**` and map parity requirements into `backend/app/**`.
2. Implement/verify parity in FastAPI routes, models, services, and tests.
3. Remove TypeScript backend files and Node backend scripts/config entries.
4. Update docs/deployment instructions to Python-only backend startup commands.
5. Validate with API smoke tests from mobile app integration path.

Rollback strategy: restore removed TypeScript backend from version control and revert docs/deployment updates if Python-only cutover reveals blocking regressions.

## Open Questions

- Do we keep `backend/package.json` only for auxiliary tooling, or remove Node backend package artifacts entirely?
- Which deployment target (Docker/hosted platform) should be treated as canonical for post-migration verification?
- Should we add contract tests from frontend against FastAPI responses before deletion to guarantee shape parity?
