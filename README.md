# Samurai Agent

Samurai Agent is an AI senior engineer that 10x’s your vibe coding — it crafts specs you can drop into Cursor for the exact code on the first try

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

# How to Use Samurai Agent

## 🚀 Getting Started

### 1. Initial Project Setup
After launching Samurai Agent, start by providing context about your project:

1. **Add Project Details**: Click the "Add Project Detail and Codebase" button at the top of the interface
2. **Connect Your Codebase**: Let Samurai Agent scan your existing code to understand the current architecture and patterns

This initial setup helps Samurai Agent provide more accurate and contextual recommendations.

### 2. Working with Samurai Agent

#### Step 1: Describe Your Goal
Start by describing what you want to implement. You can be as vague or specific as you'd like:

- **Vague**: "I want to add user authentication"
- **Specific**: "I need a login form with email/password validation and JWT tokens"

#### Step 2: Specification Refinement
Samurai Agent will ask clarifying questions to understand your requirements better. Common questions include:

- What technologies/frameworks should be used?
- What's the user experience flow?
- Are there any specific design requirements?
- What edge cases should be handled?

**Pro Tip**: The more detailed your responses, the better the final specification will be.

#### Step 3: Task Generation
Once you've provided sufficient information:

1. Click the **"Create Tasks Based on Discussion"** button at the bottom of the chat
2. Samurai Agent will automatically generate a structured task breakdown in the right sidebar
3. Each task includes detailed specifications ready for implementation

#### Step 4: Implementation
- **View Task Details**: Click on any task to see its full description and sub-tasks
- **Copy to Cursor**: The task descriptions are formatted to be copy-pasted directly into Cursor or any AI coding assistant
- **Follow the Flow**: Tasks are organized in logical order - start with the first task and work your way down
