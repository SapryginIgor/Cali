## 1. Inline Input Bar UI

- [x] 1.1 Remove the FAB (`fabContainer`, `fab`, `fabGradient` styles and the `TouchableOpacity` + `LinearGradient` + `Plus` icon block) from `app/(main)/index.tsx`
- [x] 1.2 Add an inline input bar component at the bottom of the main screen with: camera button (left), text input with placeholder "What did you eat?" (center), send button (right)
- [x] 1.3 Wrap the input bar in `KeyboardAvoidingView` so it stays above the keyboard on iOS
- [x] 1.4 Add photo thumbnail preview with X dismiss button that appears in the input bar when a photo is attached
- [x] 1.5 Style the input bar to match the existing app design (warm gradient theme, `Colors.light` palette)

## 2. Submit Logic Changes

- [x] 2.1 Update `handleSubmit` to allow text-only submissions (remove the "Photo required" alert and `selectedImage` guard)
- [x] 2.2 Disable/hide the send button when both text is empty and no photo is attached
- [x] 2.3 Ensure `processPendingEntry` handles entries without `imageUri` (text-only analysis path)

## 3. Camera Modal Integration

- [x] 3.1 Change `handleOpenLogMeal` to be triggered by the camera button in the input bar instead of the FAB
- [x] 3.2 After photo capture/gallery selection in the modal, close the modal and show the photo as a thumbnail in the input bar (set `selectedImage` state, modal closes)
- [x] 3.3 Keep the existing camera modal UI intact (capture, retake, flip, gallery buttons)

## 4. Cleanup & Testing

- [x] 4.1 Remove unused FAB-related styles from `StyleSheet.create`
- [x] 4.2 Verify text-only log creates a pending entry and triggers AI analysis
- [x] 4.3 Verify photo+text log works end-to-end through the input bar
- [x] 4.4 Update e2e test in `tests/e2e/` if it relies on the FAB flow
