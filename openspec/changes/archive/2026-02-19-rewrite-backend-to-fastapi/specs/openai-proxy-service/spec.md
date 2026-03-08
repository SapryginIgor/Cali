## MODIFIED Requirements

**Note**: All requirements remain identical - same functionality, error handling, and response formats. Implementation changes from Node.js OpenAI SDK to Python OpenAI SDK. Uses async/await patterns native to FastAPI.

### Requirement: OpenAI client initialization
The system SHALL initialize an OpenAI client using API key from environment variables.

**Implementation**: Python `openai` library client initialized with API key from environment. Lazy initialization pattern (initialize on first use) or at FastAPI startup using dependency injection.

#### Scenario: Client initializes with valid API key
- **WHEN** system starts and `OPENAI_API_KEY` environment variable is set
- **THEN** OpenAI client is initialized and ready to process requests

#### Scenario: Missing API key prevents initialization
- **WHEN** system starts and `OPENAI_API_KEY` environment variable is not set
- **THEN** system logs error and fails to start with clear error message

### Requirement: Food image analysis function
The system SHALL provide a function that analyzes food images using GPT-4 Vision API.

**Implementation**: Python async function `async def analyze_food_image(image_base64: str, description: Optional[str] = None)` using Python OpenAI SDK with async/await.

#### Scenario: Function accepts base64 image and description
- **WHEN** `analyze_food_image(image_base64: str, description: Optional[str] = None)` is called with valid base64 image
- **THEN** function constructs OpenAI vision API request using Python SDK and returns structured nutrition data

#### Scenario: Function handles image without description
- **WHEN** `analyze_food_image(image_base64: str)` is called without description parameter
- **THEN** function constructs prompt without additional context and processes image

#### Scenario: Function includes description in prompt when provided
- **WHEN** `analyze_food_image(image_base64: str, description: str)` is called with description
- **THEN** function includes description as additional context in the prompt sent to OpenAI

### Requirement: Prompt construction for nutrition analysis
The system SHALL construct prompts that instruct OpenAI to return structured nutrition data.

**Implementation**: Same prompt structure as Node.js version. Python string formatting used instead of template literals.

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

**Implementation**: Python OpenAI SDK supports `response_format={"type": "json_object"}` same as Node.js SDK. Response parsed using Python `json` module and validated with Pydantic.

#### Scenario: Response matches NutritionResult schema
- **WHEN** OpenAI API returns response
- **THEN** response is parsed using Python json and validated with Pydantic model to match NutritionResult interface (carbs, protein, fats, calories as numbers, analysis as string)

#### Scenario: Structured output ensures consistent format
- **WHEN** OpenAI API is called with structured output configuration (`response_format={"type": "json_object"}`)
- **THEN** response is guaranteed to match expected schema format without manual parsing

#### Scenario: Invalid response structure is handled
- **WHEN** OpenAI returns response that does not match expected schema
- **THEN** system logs error, attempts to extract valid data using Python dict operations, or returns error to caller

### Requirement: Error handling for OpenAI API failures
The system SHALL handle OpenAI API errors gracefully and provide meaningful error information.

**Implementation**: Python OpenAI SDK raises `openai.APIError` exceptions. Handle using try/except blocks and map to FastAPI HTTP exceptions.

#### Scenario: API authentication error is handled
- **WHEN** OpenAI API returns 401 Unauthorized (invalid API key)
- **THEN** system logs error, raises HTTPException(500) with generic message, and does not expose API key

#### Scenario: API rate limit error is handled
- **WHEN** OpenAI API returns 429 Too Many Requests
- **THEN** system logs error, raises HTTPException(503) with message indicating temporary unavailability

#### Scenario: API timeout is handled
- **WHEN** OpenAI API call exceeds timeout (e.g., 60 seconds)
- **THEN** system catches timeout exception, logs timeout error, raises HTTPException(503)

#### Scenario: API network error is handled
- **WHEN** network error occurs during OpenAI API call
- **THEN** system catches network exception, logs error, raises HTTPException(503)

#### Scenario: API invalid response is handled
- **WHEN** OpenAI API returns unexpected response format or status code
- **THEN** system logs error with response details, raises HTTPException(500)

### Requirement: Model selection
The system SHALL use GPT-4 Vision model (gpt-4-vision-preview or gpt-4o) for image analysis.

**Implementation**: Python OpenAI SDK `model` parameter set to "gpt-4o" (same as Node.js version).

#### Scenario: Correct model is used for vision requests
- **WHEN** OpenAI API call is made using Python SDK
- **THEN** request specifies GPT-4 Vision model capable of processing images

#### Scenario: Model supports vision capabilities
- **WHEN** image analysis request is made
- **THEN** selected model supports vision/image input capabilities

### Requirement: Image format handling
The system SHALL handle images in formats supported by OpenAI Vision API.

**Implementation**: Python `base64` module for base64 encoding/decoding. PIL/Pillow library for image format validation if needed.

#### Scenario: Common image formats are supported
- **WHEN** image is provided in JPEG, PNG, or WebP format
- **THEN** system processes image without conversion (or validates format using PIL if needed)

#### Scenario: Base64 image is properly formatted for API
- **WHEN** base64 image string is provided
- **THEN** system formats image data according to OpenAI Vision API requirements using Python base64 module (data URL format or base64 string)

### Requirement: Response parsing and validation
The system SHALL parse and validate OpenAI responses before returning to caller.

**Implementation**: Python `json.loads()` for parsing, Pydantic model for validation. Python type conversion and error handling.

#### Scenario: Valid response is parsed correctly
- **WHEN** OpenAI returns valid JSON matching NutritionResult schema
- **THEN** system parses response using json module, validates with Pydantic model, and returns structured data

#### Scenario: Missing fields are handled
- **WHEN** OpenAI response is missing required fields (carbs, protein, fats, calories, or analysis)
- **THEN** system logs warning, attempts to use defaults or extract from analysis text using Python dict operations, or returns error

#### Scenario: Invalid field types are handled
- **WHEN** OpenAI response contains fields with incorrect types (e.g., string instead of number)
- **THEN** system attempts type conversion using Python type casting, logs warning if conversion fails, or returns error

#### Scenario: Analysis text is sanitized
- **WHEN** analysis field contains text
- **THEN** system ensures text is non-empty and properly formatted using Python string methods before returning
