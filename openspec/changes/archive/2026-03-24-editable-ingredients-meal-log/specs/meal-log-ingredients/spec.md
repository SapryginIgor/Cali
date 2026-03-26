## ADDED Requirements

### Requirement: Meal log captures structured ingredient lists
The system MUST store meal log entries with an `ingredients` collection composed of structured ingredient objects rather than relying only on a single free-form meal description.

#### Scenario: Create meal log with multiple ingredients
- **WHEN** a user logs a meal that contains multiple ingredients
- **THEN** the persisted meal log contains an `ingredients` array with one item per ingredient

#### Scenario: Persist required ingredient fields
- **WHEN** an ingredient item is saved
- **THEN** the item includes required fields for ingredient `name`, `quantity`, `carbs`, `fats`, and `proteins`

#### Scenario: Macro fields use explicit numeric units
- **WHEN** an ingredient item is persisted
- **THEN** `carbs`, `fats`, and `proteins` are stored as explicit gram values on that ingredient item

### Requirement: Prompt requests machine-readable ingredient output
The meal parsing prompt MUST instruct the model to return a machine-readable payload that includes an `ingredients` array with stable ingredient object fields.

#### Scenario: Prompt includes explicit output schema
- **WHEN** the system prepares the meal logging prompt for model inference
- **THEN** the prompt includes explicit instructions for returning structured ingredient objects with per-item `carbs`, `fats`, and `proteins`

#### Scenario: Prompt supports complex meals
- **WHEN** a meal contains nested or many components
- **THEN** the prompt requests every component as separate ingredient entries in the structured payload

### Requirement: Structured output is validated before persistence
The system MUST validate model output against the ingredient payload schema and reject or recover from invalid responses before writing meal logs.

#### Scenario: Valid payload is accepted
- **WHEN** model output matches the required ingredient schema
- **THEN** the meal log is persisted with structured ingredients

#### Scenario: Invalid payload is rejected safely
- **WHEN** model output omits required fields or has invalid structure
- **THEN** the system does not persist malformed ingredient data and surfaces a recoverable error path

#### Scenario: Invalid macro fields are rejected safely
- **WHEN** model output includes non-numeric or missing `carbs`, `fats`, or `proteins` on an ingredient
- **THEN** the system rejects that payload (or retries/fallbacks) and never persists invalid macro values

### Requirement: Users can edit ingredient items in existing meal logs
The system MUST allow users to add, update, and remove individual ingredient items for an existing meal log entry.

#### Scenario: Add ingredient to existing log
- **WHEN** a user submits an add-ingredient action
- **THEN** the new ingredient item is appended after schema validation

#### Scenario: Update ingredient fields
- **WHEN** a user edits an ingredient name, quantity, unit, or note
- **THEN** only the targeted ingredient item is updated and the meal log remains valid

#### Scenario: Update ingredient macro fields
- **WHEN** a user edits `carbs`, `fats`, or `proteins` for a single ingredient
- **THEN** only that ingredient's macro fields are updated and unrelated ingredients remain unchanged

#### Scenario: Remove ingredient from list
- **WHEN** a user removes an ingredient item
- **THEN** the ingredient is deleted from the meal log without modifying unrelated items
