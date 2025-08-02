# Samurai Agent

An AI-powered development assistant that breaks down complex features into actionable tasks with optimized prompts for Cursor.

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
uvicorn main:app --reload
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
├── docs/              # Documentation
└── .github/           # GitHub workflows
```

## Features

- AI-powered task breakdown
- Optimized prompts for Cursor
- Project memory management
- Real-time chat interface
- Task and memory panels

## Development

Both services can run simultaneously on different ports. The frontend communicates with the backend via REST API calls. 