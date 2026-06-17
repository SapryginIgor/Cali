## ADDED Requirements

### Requirement: Client-side gate on meal logging

The "Log meal" action (FAB button → camera/analysis flow) SHALL check `isPremium` from the subscription context before proceeding. If `isPremium` is `false`, the paywall SHALL be presented instead of opening the camera.

#### Scenario: Active trial user taps Log Meal
- **WHEN** a user with an active trial taps the FAB button
- **THEN** the camera/capture modal opens normally

#### Scenario: Expired trial user taps Log Meal
- **WHEN** a user with an expired trial taps the FAB button
- **THEN** the paywall modal is presented instead of the camera

#### Scenario: Premium user taps Log Meal
- **WHEN** a premium subscriber taps the FAB button
- **THEN** the camera/capture modal opens normally

### Requirement: Server-side subscription enforcement on analyze endpoint

The `/api/analyze-food` and `/api/logs` POST endpoints SHALL verify the caller's subscription status before processing. The client SHALL send the Supabase access token in the `Authorization: Bearer <token>` header. The backend SHALL verify the JWT, extract the user ID, query the `profiles` table, and reject requests from users whose trial has expired or subscription is inactive.

#### Scenario: Request from active trial user
- **WHEN** a request arrives with a valid JWT for a user whose `subscription_status = 'trialing'` and `trial_ends_at` is in the future
- **THEN** the request is processed normally

#### Scenario: Request from expired trial user
- **WHEN** a request arrives with a valid JWT for a user whose trial has expired
- **THEN** the server responds with HTTP 403 and body `{"detail": "Trial expired. Subscribe to continue."}`

#### Scenario: Request from premium user
- **WHEN** a request arrives with a valid JWT for a user with `subscription_status = 'premium'`
- **THEN** the request is processed normally

#### Scenario: Request without auth token
- **WHEN** a request arrives without an `Authorization` header
- **THEN** the server responds with HTTP 401 and body `{"detail": "Authentication required"}`

#### Scenario: Request with invalid token
- **WHEN** a request arrives with an invalid or expired JWT
- **THEN** the server responds with HTTP 401 and body `{"detail": "Invalid or expired token"}`

### Requirement: Backend Supabase JWT verification middleware

The FastAPI backend SHALL include middleware or a dependency that verifies Supabase JWTs. Verification SHALL validate the token signature using the Supabase JWT secret (`SUPABASE_JWT_SECRET` environment variable), check expiration, and extract the `sub` claim as the user ID.

#### Scenario: Valid token
- **WHEN** a request includes a valid, non-expired Supabase JWT
- **THEN** the middleware extracts the user ID and makes it available to the route handler

#### Scenario: Expired token
- **WHEN** a request includes an expired Supabase JWT
- **THEN** the middleware rejects the request with HTTP 401

### Requirement: Existing meal history remains accessible

Users with an expired trial SHALL still be able to view their previously logged meals, browse the calendar, and see historical nutrition data. Only the creation of new meal logs (AI analysis) is gated.

#### Scenario: Expired trial user browses history
- **WHEN** a user with an expired trial opens the app
- **THEN** the main screen loads with all previously logged meals visible and browsable

#### Scenario: Expired trial user tries to edit existing meal
- **WHEN** a user with an expired trial taps edit on an existing meal
- **THEN** the edit modal opens and changes can be saved (editing existing data is not gated)
