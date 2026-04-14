## Context

The main screen (`app/(main)/index.tsx`) currently uses a FAB that opens a full-screen camera modal. The modal has a camera viewfinder, capture button, gallery picker, text caption input, and submit button. A photo is required to submit — text-only logging is not supported. This creates unnecessary friction for quick entries like "black coffee" or "banana".

## Goals / Non-Goals

**Goals:**
- Inline input bar at the bottom of the main screen for instant text or photo logging
- Text-only submissions (no photo required)
- Camera button in the input bar opens the existing camera modal for photo capture
- After photo capture, return to main screen with photo thumbnail attached to the input bar
- Zero intermediate screens for text-only logs

**Non-Goals:**
- Redesigning the camera modal itself (keep existing capture/gallery/flip flow)
- Adding new backend endpoints for text-only analysis (backend already handles text-only via description field)
- Changing the edit modal or meal card UI
- Multi-photo support

## Decisions

**1. Inline input bar replaces FAB**
The FAB + `Plus` icon is removed. A persistent input bar sits at the bottom of the screen (above safe area), containing: text input, camera button, and send button. This mirrors chat-app UX patterns users already know.

Alternative: Keep FAB and add a separate text input — rejected because it splits attention and doesn't reduce steps.

**2. Input bar layout**
Left: camera button (opens camera modal). Center: expanding text input with placeholder "What did you eat?". Right: send button (appears when text is non-empty OR a photo is attached).

When a photo is attached, show a small thumbnail to the left of the text input with an X to remove it.

**3. Submit without photo**
`handleSubmit` is updated to allow submission when `inputText.trim()` is non-empty, even without `selectedImage`. The `processPendingEntry` flow already handles text-only analysis (sends description to backend or mock). The "Photo required" alert is removed.

**4. Camera modal reuse**
The existing full-screen camera modal is kept intact. It's triggered by the camera button in the input bar instead of the FAB. After capture/selection, the modal closes and the image URI is set in state, showing as a thumbnail in the input bar.

**5. KeyboardAvoidingView**
The input bar wraps in `KeyboardAvoidingView` so it stays visible when the keyboard opens for text entry.

## Risks / Trade-offs

- **Text-only analysis quality**: Without a photo, AI analysis relies solely on text description, which is less accurate → acceptable trade-off for speed; user can always add a photo for better results
- **Input bar takes vertical space**: ~50-60px at the bottom of the scroll area → minimal impact, and it's the primary action surface
- **Breaking change for e2e tests**: The FAB-based flow changes → e2e tests need updating to use the new input bar
