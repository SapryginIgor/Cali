## 1. Unified media intake UX

- [x] 1.1 Identify current camera/gallery entry points and refactor to a single intake flow state model.
- [x] 1.2 Implement source chooser UI that offers "Take Photo" and "Choose from Gallery" from one entry point.
- [x] 1.3 Route both camera capture and gallery selection to the same confirmation composer screen.
- [x] 1.4 Add optional description input to the composer and ensure confirm is enabled with image-only payload.
- [x] 1.5 Remove/disable any post-confirm description step so confirm immediately triggers submission.

## 2. Backend async log lifecycle

- [x] 2.1 Extend log schema/model with analysis lifecycle fields (status, created/updated timestamps, failure metadata as needed).
- [x] 2.2 Update log creation endpoint to persist log immediately with `pending` status and return it in response.
- [x] 2.3 Add enqueue step after log creation to dispatch analysis work using existing async mechanism or queue worker.
- [x] 2.4 Implement/adjust worker handler to process pending logs and update the same record to `completed` with results or `failed` with error details.
- [x] 2.5 Add idempotency or duplicate-submit protection for repeated confirm actions.

## 3. Client status updates and presentation

- [x] 3.1 Render newly created pending logs immediately in history/feed with clear pending status indicator.
- [x] 3.2 Implement status refresh path (existing realtime subscription or polling fallback) to update pending logs when backend status changes.
- [x] 3.3 Display finalized analysis results in-place once status becomes `completed`, and show failure state handling for `failed`.
- [x] 3.4 Ensure app foreground/resume refreshes stale pending items.

## 4. Verification and rollout

- [ ] 4.1 Add/adjust tests for unified intake flow including camera path, gallery path, with/without description, and immediate submit behavior.
- [x] 4.2 Add/adjust backend tests for pending creation, async completion, failure transitions, and duplicate-submit guard behavior.
- [x] 4.3 Add integration/e2e coverage validating pending-to-completed client update lifecycle.
- [x] 4.4 Define release monitoring checks for pending age, failure rates, and queue backlog after deployment.
