## Why

The current logging flow adds friction by splitting media confirmation and text description into separate steps, and it blocks users while analysis completes. This slows down quick logging moments and makes the app feel unresponsive during processing.

## What Changes

- Add a single media intake flow where users can choose either camera capture or gallery upload from the same entry point.
- Make text description optional and collect it in the same step as media selection/capture so confirmation immediately starts processing.
- Change log creation to asynchronous analysis: once the user confirms, create the log immediately with a `pending` analysis state.
- Update client and backend behavior so pending logs appear right away in history/feed and are later updated in place when analysis completes.
- Add background processing and status transitions for analysis completion and failure handling.

## Capabilities

### New Capabilities
- `photo-input-unified-flow`: Unified capture/upload flow with optional inline description and immediate processing on confirmation.
- `asynchronous-log-analysis-lifecycle`: Non-blocking log creation with pending status, background analysis, and eventual status/result updates.

### Modified Capabilities
- None.

## Impact

- Affected mobile log creation UI/UX and navigation flow.
- Affected backend log ingestion and analysis orchestration endpoints/services.
- Requires persistence model updates for analysis status fields (for example pending/completed/failed) and timestamps.
- May require background job/queue worker integration or expansion of an existing async task mechanism.
- Requires client-side refresh strategy (polling or realtime updates) so pending logs update when analysis finishes.
