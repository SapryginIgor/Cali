## ADDED Requirements

### Requirement: User can choose media source from one intake entry point
The system SHALL present camera capture and gallery upload options within a single log intake flow before confirmation.

#### Scenario: Source options are available at intake start
- **WHEN** the user opens the new log intake flow
- **THEN** the system shows actions to take a new photo or choose an image from gallery

#### Scenario: Camera capture and gallery selection converge to one composer state
- **WHEN** the user completes either camera capture or gallery selection
- **THEN** the system navigates to the same confirmation composer with the selected image loaded

### Requirement: Optional description is collected inline before confirm
The system SHALL allow the user to provide an optional text description in the same composer state used for image confirmation.

#### Scenario: User confirms without description
- **WHEN** the user has selected an image and leaves description empty
- **THEN** the system allows confirmation and submits the log request without description text

#### Scenario: User confirms with description
- **WHEN** the user enters description text and confirms
- **THEN** the system submits the same log request with both image and description fields

### Requirement: Confirm action starts processing immediately without extra form step
The system SHALL begin log submission immediately after user confirmation and SHALL NOT require an additional post-confirm description screen.

#### Scenario: No intermediate step after confirmation
- **WHEN** the user presses confirm from the composer
- **THEN** the system immediately invokes log creation and transitions the UI to the post-submit state
