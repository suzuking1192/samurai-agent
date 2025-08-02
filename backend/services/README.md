# Services

This directory contains the backend services for the Samurai Agent project.

## Gemini Service Setup

### 1. Environment Configuration

1. Copy the environment example file:
   ```bash
   cp env.example .env
   ```

2. Add your Gemini API key to `.env`:
   ```
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

### 2. Dependencies

The required dependencies are already included in `requirements.txt`:
- `google-generativeai==0.3.2`
- `python-dotenv==1.0.0`

### 3. Testing the Service

You can test the Gemini service directly:

```bash
cd backend
python services/gemini_service.py
```

### 4. Usage Examples

```python
from services.gemini_service import GeminiService

# Initialize the service
service = GeminiService()

# Basic chat
response = await service.chat("What is FastAPI?")

# With project context
context = "Project: Todo App, Tech: React + FastAPI, Goal: Build user auth"
response = await service.chat("How should I implement login?", context)

# With custom system prompt
system_prompt = "You are an expert Python developer. Be concise and practical."
response = await service.chat_with_system_prompt("Explain Pydantic models", system_prompt)
```

## Service Architecture

- **GeminiService**: Simple wrapper for Google Gemini AI API
- **Future**: AI agent logic will be added in a separate service file 