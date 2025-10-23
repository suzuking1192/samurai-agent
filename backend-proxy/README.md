# Samurai Agent Beta Proxy

A secure backend proxy service for handling `gemini-2.5-flash-beta` requests from the Samurai Agent VS Code extension.

## Overview

This service validates beta codes server-side and routes requests to the Gemini API using a sponsored API key, preventing API key exposure in the client.

## Features

- **Secure API Key Management**: Beta API key never leaves the server
- **Beta Code Validation**: Server-side validation of user-provided beta codes
- **Error Handling**: Comprehensive error mapping and logging
- **Health Checks**: Built-in health monitoring for deployment platforms
- **CORS Support**: Configurable CORS for security

## API Endpoints

### POST /api/gemini-beta/chat

Handles chat completion requests for the beta model.

**Request Body:**
```json
{
  "model": "gemini-2.5-flash-beta",
  "messages": [
    {
      "role": "user",
      "content": "Hello, world!"
    }
  ],
  "temperature": 0.7,
  "maxTokens": 1000,
  "betaCode": "BETA-SA-2025-7K9M"
}
```

**Success Response:**
```json
{
  "type": "success",
  "payload": {
    "content": "Hello! How can I help you today?",
    "usage": {
      "promptTokens": 10,
      "completionTokens": 15,
      "totalTokens": 25
    },
    "processingTime": 1250
  }
}
```

**Error Response:**
```json
{
  "type": "error",
  "error": "Invalid beta code provided",
  "errorCode": "INVALID_BETA_CODE"
}
```

### GET /health

Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BETA_GEMINI_API_KEY` | Gemini API key for beta access | Yes |
| `VALID_BETA_CODE` | Valid beta code for validation | Yes |
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `ALLOWED_ORIGIN` | CORS allowed origin | No |

## Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.template .env
   # Edit .env with your actual values
   ```

3. **Run in development mode:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   npm start
   ```

## Deployment

### Render.com

1. Connect your repository to Render
2. Set environment variables in Render dashboard
3. Deploy using the provided Dockerfile

### Docker

```bash
# Build image
docker build -t samurai-agent-beta-proxy .

# Run container
docker run -p 3000:3000 \
  -e BETA_GEMINI_API_KEY=your_key \
  -e VALID_BETA_CODE=your_code \
  samurai-agent-beta-proxy
```

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_BETA_CODE` | Beta code validation failed |
| `MISSING_BETA_CODE` | No beta code provided |
| `INVALID_REQUEST` | Malformed request body |
| `GEMINI_API_ERROR` | Error from Gemini API |
| `RATE_LIMIT` | Rate limit exceeded |
| `INTERNAL_ERROR` | Server internal error |

## Security

- API keys are never logged or exposed
- Beta code validation is performed server-side
- CORS can be configured for additional security
- All requests are logged for monitoring
- Health checks prevent deployment of unhealthy instances

## Monitoring

The service includes:
- Request/response logging
- Error tracking
- Health check endpoint
- Uptime monitoring
- Performance metrics
