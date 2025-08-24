# Samurai Agent

Samurai Agent is an AI senior engineer that 10x’s your vibe coding — it crafts specs you can drop into Cursor for the exact code on the first try

## 🚀 Samurai Agent Cloud (Coming Soon)

We’re building the SaaS version of Samurai Agent 
👉 [Join the waitlist here](https://tally.so/r/3yQOJx)


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

#### Step 1: Start Fresh for New Tasks
**Important**: When you want to work on a new task or feature, always click the **"Start New Conversation"** button first. This ensures:
- Clean context for your new request
- Better focus on the current task
- Avoids confusion from previous discussions

#### Step 2: Describe Your Goal
Start by describing what you want to implement. You can be as vague or specific as you'd like:

e.g 

"Currently, the status appears on the task card in very small text, so I want to make it larger and color-coded based on the status type."

#### Step 3: Specification Refinement
Samurai Agent will ask clarifying questions to understand your requirements better. 

for example

"Excellent! This clarifies your intent to enhance the visual display of the task status on the task cards.

Based on the CompactTaskItem.tsx code context, I see that the task status is currently displayed in a few ways:

An icon (e.g., '📋', '⏳', '✅') which is rendered by <span className="task-status-icon"> and already gets its color from getStatusColor(task.status).
A dropdown (<select>) that shows the current status (e.g., "Pending", "In Progress", "Completed") and allows changing it. The options themselves contain the status text.
A small status-dot which also gets its background color from getStatusColor(task.status).

When you say "status is showing on task card with very small text", are you referring to the text displayed within the dropdown itself (e.g., the word "Pending" as the currently selected option)? Or is there another specific text element on the task card displaying the status that you'd like to target for increased size and color?"

**Pro Tip**: The more detailed your responses, the better the final specification will be.

#### Step 4: Task Generation
Once you've provided sufficient information:

1. Click the **"Create Tasks Based on Discussion"** button at the bottom of the chat
2. Samurai Agent will automatically generate a structured task breakdown in the right sidebar
3. Each task includes detailed specifications ready for implementation

#### Step 5: Implementation
- **View Task Details**: Click on any task to see its full description and sub-tasks
- **Copy to Cursor**: The task descriptions are formatted to be copy-pasted directly into Cursor or any AI coding assistant
- **Follow the Flow**: Tasks are organized in logical order - start with the first task and work your way down
