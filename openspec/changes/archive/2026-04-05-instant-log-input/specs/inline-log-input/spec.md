## ADDED Requirements

### Requirement: Inline input bar is always visible on main screen
The main screen SHALL display a persistent input bar at the bottom, containing a text input field, a camera button, and a send button. The FAB (floating action button) SHALL be removed.

#### Scenario: User opens the app
- **WHEN** user navigates to the main screen
- **THEN** an input bar is visible at the bottom with placeholder text "What did you eat?", a camera button, and a send button

### Requirement: Text-only meal logging
The system SHALL allow users to submit a meal log with only a text description and no photo.

#### Scenario: User types a description and submits
- **WHEN** user types "black coffee" in the input bar and taps send
- **THEN** a new food entry is created with `pendingDescription: "black coffee"`, `analysisStatus: "pending"`, and no `imageUri`
- **AND** the input bar is cleared

#### Scenario: User tries to submit with empty input and no photo
- **WHEN** the input bar text is empty and no photo is attached
- **THEN** the send button is disabled or hidden

### Requirement: Photo attachment via camera button
The camera button in the input bar SHALL open the existing full-screen camera modal for photo capture or gallery selection.

#### Scenario: User taps camera button
- **WHEN** user taps the camera button in the input bar
- **THEN** the full-screen camera modal opens (requesting camera permission if needed)

#### Scenario: User captures a photo in the modal
- **WHEN** user takes a photo or selects from gallery in the camera modal
- **THEN** the modal closes and a thumbnail of the selected photo appears in the input bar

### Requirement: Photo thumbnail with removal
When a photo is attached, the input bar SHALL show a small thumbnail preview with a dismiss button to remove the photo.

#### Scenario: User removes attached photo
- **WHEN** user taps the X button on the photo thumbnail in the input bar
- **THEN** the photo is removed and the input bar returns to its default state (text-only)

### Requirement: Photo-with-text meal logging
The system SHALL allow users to submit a meal log with both a photo and optional text description.

#### Scenario: User attaches photo and adds description
- **WHEN** user has a photo attached and types "lunch salad" and taps send
- **THEN** a new food entry is created with `imageUri` set to the photo, `pendingDescription: "lunch salad"`, and `analysisStatus: "pending"`

#### Scenario: User attaches photo without description
- **WHEN** user has a photo attached, text is empty, and taps send
- **THEN** a new food entry is created with `imageUri` set to the photo and `analysisStatus: "pending"`

### Requirement: Keyboard behavior
The input bar SHALL remain visible and accessible when the keyboard is open.

#### Scenario: User taps text input
- **WHEN** user taps the text input field
- **THEN** the keyboard opens and the input bar moves up above the keyboard
