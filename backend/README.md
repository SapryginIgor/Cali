# Cali Backend API

Backend API for food analysis using OpenAI GPT-4 Vision. This service acts as a secure proxy between the mobile app and OpenAI's API, protecting API keys and providing rate limiting.

## Features

- **Food Image Analysis**: Analyze food images using GPT-4 Vision API
- **Secure API Key Management**: API keys stored server-side only
- **Rate Limiting**: 20 requests per 15 minutes per IP
- **Input Validation**: Validates image size, format, and description length
- **Error Handling**: User-friendly error messages without exposing internal details
- **CORS Support**: Configured for mobile app origins

## Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key

### Installation

1. Install dependencies:
```bash
cd backend
npm install
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
```env
PORT=3000
OPENAI_API_KEY=sk-your-openai-api-key-here
NODE_ENV=development
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=20
```

### Development

Run the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000` (or the port specified in `.env`).

### Build

Build for production:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## API Endpoints

### POST /api/analyze-food

Analyzes a food image and returns nutritional information.

**Request Body (JSON):**
```json
{
  "image": "base64-encoded-image-string",
  "description": "Optional text description",
  "userId": "Optional user identifier"
}
```

**Request Body (Multipart Form Data):**
- `image`: Image file (JPEG, PNG, or WebP)
- `description`: Optional text description (max 500 characters)
- `userId`: Optional user identifier

**Response:**
```json
{
  "carbs": 45,
  "protein": 20,
  "fats": 15,
  "calories": 400,
  "analysis": "This appears to be a balanced meal..."
}
```

**Error Responses:**

- `400 Bad Request`: Invalid request (missing image, invalid format, size exceeded)
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: OpenAI service unavailable

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `OPENAI_API_KEY` | OpenAI API key (required) | - |
| `NODE_ENV` | Environment (development/production) | `development` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | `900000` (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | Maximum requests per window | `20` |

## Testing

### Example curl commands

**Test with base64 image:**
```bash
curl -X POST http://localhost:3000/api/analyze-food \
  -H "Content-Type: application/json" \
  -d '{
    "image": "base64-encoded-image-here",
    "description": "Grilled chicken salad"
  }'
```

**Test with multipart form data:**
```bash
curl -X POST http://localhost:3000/api/analyze-food \
  -F "image=@/path/to/image.jpg" \
  -F "description=Grilled chicken salad"
```

## Deployment

### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Deploy: `vercel`
3. Set environment variables in Vercel dashboard

### Railway

1. Connect your repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

### Render

1. Create a new Web Service
2. Connect your repository
3. Set environment variables
4. Deploy

## Frontend Configuration

To use this backend from the mobile app, set the `EXPO_PUBLIC_BACKEND_URL` environment variable:

**Development:**
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000
```

**Production:**
```env
EXPO_PUBLIC_BACKEND_URL=https://your-backend-url.com
```

The frontend will automatically fall back to mock implementation if the backend URL is not configured.

## Security Considerations

- API keys are stored only in environment variables, never in code
- Rate limiting prevents abuse and cost overruns
- Input validation on all requests
- CORS configured for mobile app origins only
- Error messages don't expose internal details or API keys

## Rate Limiting

The API enforces rate limits:
- **Limit**: 20 requests per 15 minutes per IP address
- **Headers**: Rate limit info included in response headers
- **Response**: 429 status when limit exceeded

## Error Handling

All errors return user-friendly messages:
- Validation errors: Specific messages about what failed
- Service errors: Generic messages without exposing internal details
- OpenAI errors: Mapped to appropriate HTTP status codes

## Future Enhancements

- User authentication and per-user rate limits
- Request logging and analytics
- Image caching
- Batch processing support
