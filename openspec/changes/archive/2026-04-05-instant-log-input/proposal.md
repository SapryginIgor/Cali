## Why

Currently, logging a meal requires tapping the FAB, which opens a full-screen camera modal. Users who just want to type "coffee and a croissant" must still go through the camera flow. This adds friction — the goal is zero-step logging: open the app, type or snap, submit.

## What Changes

- Replace the floating action button (FAB) + full-screen camera modal with an **inline input bar** pinned to the bottom of the main screen
- The input bar has a text field (placeholder: "What did you eat?") and a camera/photo button
- Typing text and pressing send submits a text-only log (no photo required)
- Tapping the camera button opens the existing camera/gallery flow, then returns to the input bar with the photo attached
- Photo-only and photo+text logs still work as before
- Remove the requirement that a photo is mandatory to submit (`handleSubmit` currently blocks without an image)
- The full-screen camera modal is kept but only triggered from the camera button, not as the default entry point

## Capabilities

### New Capabilities
- `inline-log-input`: Bottom input bar with text field and camera button, enabling instant text-only or photo-based meal logging without intermediate screens

### Modified Capabilities

## Impact

- `app/(main)/index.tsx` — major UI change: remove FAB, add inline input bar, update submit logic to allow text-only entries
- `lib/ai.ts` — already supports text-only analysis (description without image goes to mock/backend); no changes needed
- `backend/app/routes/analyze.py` — may need to accept requests without an image (text-only analysis)
- `tests/e2e/` — e2e tests may need updating for the new input flow
