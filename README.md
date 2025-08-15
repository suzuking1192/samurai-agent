# Samurai Agent

Samurai Agent helps you write crystal-clear specifications for AI, so you get the code you actually want on the first try with AI coding tools.

## Tech Stack

- **Frontend**: React + Vite + TypeScript
- **Backend**: FastAPI + Python + Gemini AI
- **Storage**: JSON files (no database)
- **Development**: Simple npm/pip commands for quick setup

## Quick Start

### Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv "samurai-agent"
source samurai-agent/bin/activate  # Linux/macOS
# OR on Windows: samurai-agent\Scripts\activate

pip install -r requirements.txt
cp .env.example .env
# Add your GEMINI_API_KEY to .env
# If .env.example is missing, create a new .env file manually
uvicorn main:app --reload
```

#### Run Backend with Docker

Alternatively, you can run the backend using Docker Compose:

```bash
docker compose up --build
```

The backend will be available at `http://localhost:8000`.

### Get a Gemini API key (brief)

- Visit Google AI Studio: [Create API key](https://aistudio.google.com/app/apikey)
- Sign in, click "Create API key", and copy the key
- Add it to your `.env` as:

```bash
GEMINI_API_KEY=your_key_here
```


### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The backend will run on `http://localhost:8000` and the frontend on `http://localhost:5173`.

## Project Structure

```
samurai-agent/
├── frontend/          # React + Vite + TypeScript frontend
├── backend/           # FastAPI + Python backend
```

## Features

- AI-powered task breakdown
- Optimized prompts for Cursor
- Project memory management
- Real-time chat interface
- Task and memory panels

## Development

Both services can run simultaneously on different ports. The frontend communicates with the backend via REST API calls.
