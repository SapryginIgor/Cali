## ADDED Requirements

### Requirement: OpenAI client initialization
The system SHALL initialize an OpenAI client using API key from environment variables.

#### Scenario: Client initializes with valid API key
- **WHEN** system starts and `OPENAI_API_KEY` environment variable is set
- **THEN** OpenAI client is initialized and ready to process requests

#### Scenario: Missing API key prevents initialization
- **WHEN** system starts and `OPENAI_API_KEY` environment variable is not set
- **THEN** system logs error and fails to start with clear error message

### Requirement: Food image analysis function
The system SHALL provide a function that analyzes food images using GPT-4 Vision API.

#### Scenario: Function accepts base64 image and description
- **WHEN** `analyzeFoodImage(imageBase64: string, description?: string)` is called with valid base64 image
- **THEN** function constructs OpenAI vision API request and returns structured nutrition data

#### Scenario: Function handles image without description
- **WHEN** `analyzeFoodImage(imageBase64: string)` is called without description parameter
- **THEN** function constructs prompt without additional context and processes image

#### Scenario: Function includes description in prompt when provided
- **WHEN** `analyzeFoodImage(imageBase64: string, description: string)` is called with description
- **THEN** function includes description as additional context in the prompt sent to OpenAI

### Requirement: Prompt construction for nutrition analysis
The system SHALL construct prompts that instruct OpenAI to return structured nutrition data.

#### Scenario: Prompt requests structured nutrition data
- **WHEN** prompt is constructed for food analysis
- **THEN** prompt explicitly requests carbohydrates (grams), protein (grams), fats (grams), total calories, and brief analysis text

#### Scenario: Prompt includes image analysis instruction
- **WHEN** prompt is constructed
- **THEN** prompt includes instruction to analyze the food image and provide nutritional information

#### Scenario: Prompt includes description context when available
- **WHEN** description is provided
- **THEN** prompt includes "Additional context: {description}" section

### Requirement: Structured output format
The system SHALL use OpenAI structured outputs or function calling to ensure consistent JSON responses.

#### Scenario: Response matches NutritionResult schema
- **WHEN** OpenAI API returns response
- **THEN** response is parsed and validated to match NutritionResult interface (carbs, protein, fats, calories as numbers, analysis as string)

#### Scenario: Structured output ensures consistent format
- **WHEN** OpenAI API is called with structured output configuration
- **THEN** response is guaranteed to match expected schema format without manual parsing

#### Scenario: Invalid response structure is handled
- **WHEN** OpenAI returns response that does not match expected schema
- **THEN** system logs error, attempts to extract valid data, or returns error to caller

### Requirement: Error handling for OpenAI API failures
The system SHALL handle OpenAI API errors gracefully and provide meaningful error information.

#### Scenario: API authentication error is handled
- **WHEN** OpenAI API returns 401 Unauthorized (invalid API key)
- **THEN** system logs error, returns error to caller indicating authentication failure, and does not expose API key

#### Scenario: API rate limit error is handled
- **WHEN** OpenAI API returns 429 Too Many Requests
- **THEN** system logs error, returns 503 Service Unavailable to caller with message indicating temporary unavailability

#### Scenario: API timeout is handled
- **WHEN** OpenAI API call exceeds timeout (e.g., 60 seconds)
- **THEN** system logs timeout error, returns 503 Service Unavailable to caller

#### Scenario: API network error is handled
- **WHEN** network error occurs during OpenAI API call
- **THEN** system logs error, returns 503 Service Unavailable to caller

#### Scenario: API invalid response is handled
- **WHEN** OpenAI API returns unexpected response format or status code
- **THEN** system logs error with response details, returns 500 Internal Server Error to caller

### Requirement: Model selection
The system SHALL use GPT-4 Vision model (gpt-4-vision-preview or gpt-4o) for image analysis.

#### Scenario: Correct model is used for vision requests
- **WHEN** OpenAI API call is made
- **THEN** request specifies GPT-4 Vision model capable of processing images

#### Scenario: Model supports vision capabilities
- **WHEN** image analysis request is made
- **THEN** selected model supports vision/image input capabilities

### Requirement: Image format handling
The system SHALL handle images in formats supported by OpenAI Vision API.

#### Scenario: Common image formats are supported
- **WHEN** image is provided in JPEG, PNG, or WebP format
- **THEN** system processes image without conversion

#### Scenario: Base64 image is properly formatted for API
- **WHEN** base64 image string is provided
- **THEN** system formats image data according to OpenAI Vision API requirements (data URL format or base64 string)

### Requirement: Response parsing and validation
The system SHALL parse and validate OpenAI responses before returning to caller.

#### Scenario: Valid response is parsed correctly
- **WHEN** OpenAI returns valid JSON matching NutritionResult schema
- **THEN** system parses response, validates all fields are present and correct types, and returns structured data

#### Scenario: Missing fields are handled
- **WHEN** OpenAI response is missing required fields (carbs, protein, fats, calories, or analysis)
- **THEN** system logs warning, attempts to use defaults or extract from analysis text, or returns error

#### Scenario: Invalid field types are handled
- **WHEN** OpenAI response contains fields with incorrect types (e.g., string instead of number)
- **THEN** system attempts type conversion, logs warning if conversion fails, or returns error

#### Scenario: Analysis text is sanitized
- **WHEN** analysis field contains text
- **THEN** system ensures text is non-empty and properly formatted before returning
