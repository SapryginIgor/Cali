## ADDED Requirements

### Requirement: System classifies food images into a category before analysis
The system SHALL perform a classification step on every submitted food image (or text-only input) and SHALL assign exactly one category from the defined set before proceeding to nutritional analysis.

#### Scenario: Image with visible nutrition label
- **WHEN** a food image containing a clearly visible nutrition facts panel is submitted
- **THEN** the classifier SHALL return category `nutrition_label`

#### Scenario: Packaged or branded product without readable label
- **WHEN** a food image shows branded packaging or a recognizable commercial product but no legible nutrition label
- **THEN** the classifier SHALL return category `packaged_product`

#### Scenario: Single identifiable food item
- **WHEN** a food image contains a single clearly identifiable food item (e.g., an apple, a boiled egg, a slice of bread)
- **THEN** the classifier SHALL return category `simple_food`

#### Scenario: Multi-component plated meal
- **WHEN** a food image contains multiple distinct food components or a composed dish
- **THEN** the classifier SHALL return category `complex_meal`

#### Scenario: Beverage
- **WHEN** a food image shows a drink in a cup, glass, or bottle
- **THEN** the classifier SHALL return category `beverage`

#### Scenario: Text-only submission with no image
- **WHEN** a food description is submitted without an accompanying image
- **THEN** the classifier SHALL return category `text_only`

### Requirement: Classification returns structured metadata hints
The classifier SHALL return a `hints` object alongside the category containing preliminary metadata relevant to downstream analysis.

#### Scenario: Hints for a packaged product
- **WHEN** the classifier identifies a `packaged_product`
- **THEN** the hints SHALL include `brand` (string or null) and `productName` (string or null) representing the classifier's best guess at the product identity

#### Scenario: Hints for a complex meal
- **WHEN** the classifier identifies a `complex_meal`
- **THEN** the hints SHALL include `itemCount` (integer) representing the estimated number of distinct food components visible

#### Scenario: Hints for a nutrition label
- **WHEN** the classifier identifies a `nutrition_label`
- **THEN** the hints SHALL include `hasLabel` set to `true`

### Requirement: Classification uses low-cost vision parameters
The classification call SHALL use `detail: "low"` for the image and a token budget of no more than 300 tokens to minimize cost and latency.

#### Scenario: Classification call parameters
- **WHEN** the classifier sends a request to the vision model
- **THEN** the request SHALL specify `detail: "low"` for the image URL and `max_tokens` of 300 or fewer

### Requirement: Classification failure falls back to complex_meal
If the classification call fails or returns an unrecognizable category, the system SHALL default to `complex_meal` as the fallback category and proceed with analysis.

#### Scenario: Classification API error
- **WHEN** the classification API call fails with a network or model error
- **THEN** the system SHALL use `complex_meal` as the category and proceed to the analysis step without surfacing the classification error to the caller

#### Scenario: Unrecognized category returned
- **WHEN** the classification returns a category string not in the defined set
- **THEN** the system SHALL map it to `complex_meal` and proceed
