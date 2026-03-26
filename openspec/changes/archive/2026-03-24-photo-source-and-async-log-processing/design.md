## Context

The current mobile logging flow appears to require an additional description step after photo confirmation, and log analysis is currently synchronous from the user perspective. Users therefore wait for analysis completion before they can continue using the app. This change introduces a faster capture experience and asynchronous backend processing while preserving eventual analysis quality.

## Goals / Non-Goals

**Goals:**
- Let users choose camera capture or gallery upload from a single flow entry point.
- Make description optional and collected inline during capture/select, so confirmation immediately submits.
- Persist a new log immediately with an analysis lifecycle status (`pending`, `completed`, `failed`).
- Process analysis asynchronously and update the existing log record when finished.
- Ensure users can see pending logs immediately and revisit results later without re-submitting.

**Non-Goals:**
- Redesigning the full log history UI beyond pending/completed/failed indicators.
- Changing the underlying AI model behavior or nutrition/business logic semantics.
- Implementing cross-device push notification delivery as part of this change.

## Decisions

### Decision: Single intake composer for camera or gallery plus optional text
Use one composer state model shared by both camera and gallery paths:
- Required: image asset.
- Optional: free-text description.
- Single confirm action that submits both payload parts.

Rationale:
- Removes post-confirm friction and simplifies mental model.
- Keeps payload creation consistent regardless of media source.

Alternative considered:
- Keep separate flows and merge server-side only. Rejected because it keeps UX fragmentation and extra transitions.

### Decision: Create logs before analysis, then run background analysis job
On confirm:
1. API creates log row with initial status `pending`.
2. API enqueues analysis work item referencing log ID and payload.
3. Client immediately receives created log and renders it in history/feed.

Worker updates same log with result fields and final status (`completed` or `failed`).

Rationale:
- Eliminates user wait time for analysis.
- Provides durable tracking for retries, observability, and state transitions.

Alternative considered:
- Fire-and-forget client request and create record only on completion. Rejected because users cannot see pending progress and failures become opaque.

### Decision: Client refresh strategy based on lightweight polling or existing realtime channel
Prefer existing realtime subscription mechanism if already available; otherwise poll for status updates on visible screens and on app foreground.

Rationale:
- Guarantees eventual UI consistency without blocking logging.
- Avoids introducing new infrastructure when existing transport suffices.

Alternative considered:
- Manual refresh only. Rejected due to poor feedback loop for pending items.

## Risks / Trade-offs

- [Queue backlog can delay completion] -> Add age metrics, retry policy, and operational alerts on stale pending logs.
- [Duplicate submissions from repeated confirm taps] -> Use idempotency key or temporary submit lock in client and dedupe guard on backend.
- [Inconsistent status updates if worker crashes mid-run] -> Use explicit state transitions with failure timeout and dead-letter/retry handling.
- [Pending state confusion for users] -> Show clear pending badge text and failure fallback copy with retry affordance.

## Migration Plan

1. Add nullable analysis status and timestamps to log persistence schema.
2. Deploy backend endpoint changes to create pending logs and enqueue jobs.
3. Deploy worker changes to consume jobs and finalize log records.
4. Deploy mobile UI changes for unified intake and pending/result rendering.
5. Backfill existing records with `completed` where analysis data already exists.
6. Monitor pending durations, failure rate, and duplicate-create events; roll back by reverting client to synchronous wait only if severe regressions occur.

## Open Questions

- Should failed analyses remain user-visible with retry action, or auto-retry silently before surfacing failure?
- What is the maximum acceptable pending duration before the UI changes badge text to delayed?
- Do we already have a preferred transport (realtime vs polling) in this app section that should be mandated for consistency?
