## ADDED Requirements

### Requirement: Log is created immediately in pending analysis state
The system SHALL create and persist a log record as soon as the user confirms media submission, with analysis status initialized to `pending`.

#### Scenario: Pending log returned on confirm
- **WHEN** the user confirms a valid media submission
- **THEN** the API responds with the created log containing a `pending` analysis status

### Requirement: Analysis runs asynchronously in background
The system SHALL process log analysis outside the user request cycle and SHALL update the same log record when analysis completes.

#### Scenario: Background worker completes analysis
- **WHEN** a pending log job is processed successfully
- **THEN** the system writes analysis results to the existing log record and sets status to `completed`

#### Scenario: Background worker fails analysis
- **WHEN** analysis processing fails for a pending log
- **THEN** the system sets the log status to `failed` and records failure metadata for diagnosis or retry

### Requirement: Users can see pending logs immediately and later see finalized results
The system SHALL surface pending logs in user-visible log lists and SHALL refresh log state so completed analysis appears without requiring re-submission.

#### Scenario: Pending item visible after submit
- **WHEN** the confirm request returns
- **THEN** the client renders the new log in history/feed with a pending indicator

#### Scenario: Finalized result replaces pending state
- **WHEN** analysis status for a visible pending log changes to completed or failed
- **THEN** the client updates that log entry to show final state and available analysis details
