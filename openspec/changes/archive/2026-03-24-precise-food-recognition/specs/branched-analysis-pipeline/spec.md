## ADDED Requirements

### Requirement: Analysis uses category-specific prompts
The system SHALL select a specialized system prompt for the nutritional analysis call based on the classified food category. Each category SHALL have a distinct prompt optimized for that food type.

#### Scenario: Nutrition label analysis prompt
- **WHEN** the category is `nutrition_label`
- **THEN** the analysis prompt SHALL instruct the model to extract printed nutritional values directly from the label and cross-check per-serving math against totals

#### Scenario: Packaged product analysis prompt
- **WHEN** the category is `packaged_product`
- **THEN** the analysis prompt SHALL instruct the model to identify the product by brand and name, apply known nutritional data for that product, and flag uncertainty if the product cannot be confidently identified

#### Scenario: Simple food analysis prompt
- **WHEN** the category is `simple_food`
- **THEN** the analysis prompt SHALL instruct the model to identify the food item, estimate a standard portion, and apply well-known nutritional values for that food

#### Scenario: Complex meal analysis prompt
- **WHEN** the category is `complex_meal`
- **THEN** the analysis prompt SHALL instruct the model to decompose the meal into individual components, estimate each portion using the plate or container as reference, reason through cooking method impact on macros, and sum per-ingredient values

#### Scenario: Beverage analysis prompt
- **WHEN** the category is `beverage`
- **THEN** the analysis prompt SHALL instruct the model to identify the beverage type, estimate volume, and account for additions such as sugar, milk, or cream

#### Scenario: Text-only analysis prompt
- **WHEN** the category is `text_only`
- **THEN** the analysis prompt SHALL instruct the model to parse the text description for food items and apply standard nutritional knowledge without relying on visual information

### Requirement: Token budget varies by category
The system SHALL allocate a category-appropriate `max_tokens` budget for the analysis call to allow sufficient reasoning depth for complex inputs while keeping simple inputs efficient.

#### Scenario: Complex meal token budget
- **WHEN** the category is `complex_meal`
- **THEN** the analysis call SHALL use a `max_tokens` value of at least 1200

#### Scenario: Simple food token budget
- **WHEN** the category is `simple_food` or `beverage`
- **THEN** the analysis call SHALL use a `max_tokens` value of no more than 800

### Requirement: Analysis returns a confidence score
The analysis response SHALL include a `confidence` field with a value between 0.0 and 1.0 representing the system's certainty in the nutritional estimates.

#### Scenario: Model-reported confidence
- **WHEN** the analysis model returns a self-reported confidence value
- **THEN** the system SHALL include that value in the response

#### Scenario: Heuristic confidence adjustment for macro inconsistency
- **WHEN** the sum of per-ingredient macros for any macro (carbs, fats, or protein) diverges more than 20% from the reported total
- **THEN** the system SHALL reduce the confidence value by at least 0.2

#### Scenario: Heuristic confidence adjustment for unidentified packaged product
- **WHEN** the category is `packaged_product` and the model indicates it could not confidently identify the brand or product
- **THEN** the system SHALL reduce the confidence value by at least 0.3

### Requirement: Analysis returns the classified food category
The analysis response SHALL include a `foodCategory` field containing the category string determined by the classification step.

#### Scenario: Food category in response
- **WHEN** a food analysis completes successfully
- **THEN** the response SHALL include a `foodCategory` field set to the category assigned during classification

### Requirement: All categories produce the same NutritionResult schema
Regardless of which category branch is used, the analysis SHALL return a response conforming to the existing `NutritionResult` interface (carbs, protein, fats, calories, analysis, logName, ingredients, mealNotes) extended with the optional `confidence` and `foodCategory` fields.

#### Scenario: Backward-compatible response shape
- **WHEN** any category branch completes analysis
- **THEN** the response SHALL contain all existing `NutritionResult` fields with their established types and constraints

#### Scenario: New fields are optional
- **WHEN** a client that does not expect `confidence` or `foodCategory` receives the response
- **THEN** the client SHALL be able to parse the response without error because the new fields are optional

### Requirement: Complex meal prompt encourages step-by-step reasoning
For `complex_meal` category, the system prompt SHALL explicitly guide the model through a decomposition chain: list components, estimate portions, determine per-component macros considering preparation, then sum totals.

#### Scenario: Chain-of-thought structure in complex meal prompt
- **WHEN** the system builds the analysis prompt for a `complex_meal`
- **THEN** the prompt SHALL include explicit step-by-step instructions covering component identification, portion estimation, per-component macro calculation, and total summation

### Requirement: Nutrition label prompt prioritizes printed values over estimation
For `nutrition_label` category, the analysis SHALL extract values directly from the visible label rather than estimating. The model SHALL only estimate values that are not legible on the label.

#### Scenario: Readable label values used directly
- **WHEN** the image contains a nutrition label with legible calorie and macro values
- **THEN** the analysis SHALL report those exact printed values rather than AI estimates

#### Scenario: Partially legible label
- **WHEN** some values on the nutrition label are not legible
- **THEN** the analysis SHALL extract the legible values and estimate only the missing ones, noting which values were estimated in the `analysis` field
