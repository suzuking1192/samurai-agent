# Samurai Agent

Samurai Agent is an **AI "senior engineer" for vibe coding**.
Instead of jumping straight into code, it pushes back, asks clarifying questions, and helps you **craft specs you can drop into Cursor (or similar tools) for the exact implementation on the first try**.

Now I’d love **your feedback** — where is it useful, where does it break, what would make you actually use it?

---

## ✨ Why Samurai Agent?
- **Avoid wasted coding** -> It makes you slow down, think, and spec before you code.
- **Better AI coding** -> Drop the spec into Cursor/Claude/etc. and usually get the right code first try.
- **OSS-first** -> Self-hosted, uses your own Gemini API key.
- **Simple setup** -> No database, just JSON files.

---

## 🚀 Samurai Agent Cloud (Coming Soon)
We're building a SaaS version for teams.
👉 [Join the waitlist here](https://tally.so/r/3yQOJx)

---

## 🛠️ Tech Stack
- **Frontend**: React + Vite + TypeScript
- **Backend**: FastAPI + Python + Gemini AI
- **Storage**: JSON files (no DB)

---

## ⚡ Quick Start

### 1. Clone repo

```bash
git clone https://github.com/suzuking1192/samurai-agent.git
```

### 2. Backend Setup

Copy the example env file and add your key:

```bash
cd backend
cp .env.example .env
```

Get a Gemini API key: [Google AI Studio](https://aistudio.google.com/app/apikey)

Add it to `.env`:

```bash
GEMINI_API_KEY=your_key_here
```

Run with Docker:

```bash
docker compose up --build
```

Or without Docker:

```bash
cd backend
python -m venv samurai-agent
# Linux/macOS:
source samurai-agent/bin/activate
# Windows (PowerShell):
# .\samurai-agent\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

- Backend -> http://localhost:8000
- Frontend -> http://localhost:5173

---

## 🏃 How to Use

1. **Add Project Details + Codebase** -> Gives context to Samurai Agent.
2. **Start a New Conversation** for each task -> keeps context clean.
3. **Describe Your Goal** (vague or specific).
4. **Refine Spec** -> Agent asks clarifying questions.
5. **Generate Tasks** -> Click "Create Tasks" -> structured breakdown appears.
6. **Copy to Cursor** -> Tasks are spec-ready for AI coding assistants.

---

## 🙏 Feedback Wanted
This is still early. I’d love feedback on:
- Does this workflow fit your coding style?
- Where does it help, and where does it feel unnecessary?
- What would make you use this day-to-day?

---

## 🎬 Demo

**Users could say**

```text
Currently, the status appears on the task card in very small text, so I want to make it larger and color-coded based on the status type.
```

**Samurai Agent replies**

```text
Excellent! This clarifies your intent to enhance the visual display of the task status on the task cards.

Based on the CompactTaskItem.tsx code context, I see that the task status is currently displayed in a few ways:

An icon (e.g., '📋', '⏳', '✅') which is rendered by <span className="task-status-icon"> and already gets its color from getStatusColor(task.status).
A dropdown (<select>) that shows the current status (e.g., "Pending", "In Progress", "Completed") and allows changing it. The options themselves contain the status text.
A small status-dot which also gets its background color from getStatusColor(task.status).

When you say "status is showing on task card with very small text", are you referring to the text displayed within the dropdown itself (e.g., the word "Pending" as the currently selected option)? Or is there another specific text element on the task card displaying the status that you'd like to target for increased size and color?
```

**Generated sub-task example**

```text
Context: To enable visual styling, this task ensures the current `task.status` value is explicitly rendered as a visible text label within the `CompactTaskItem`'s header, distinct from the icon and title. This addresses the user's request to modify the appearance of an 'already existing' status text.
Implementation Steps:
  - Step 1: Investigate `frontend/src/components/CompactTaskItem.tsx` to identify any existing HTML element that currently renders the raw `task.status` value (e.g., 'Pending', 'In Progress') as text within the `item-header` (excluding the dropdown `<select>` element). This addresses the user's assertion that the text 'is already there'.
  - Step 2: If a distinct text element for `task.status` is identified, apply a new class name, for example, `task-status-text-label`, to it to allow for styling. If no such distinct element is found, introduce a new `<span>` element within the `item-header`, preferably next to the `task-status-icon`, and render the `task.status` string value (e.g., `{{task.status}}`) inside it, assigning the `task-status-text-label` class.
Frontend UI Spec:
  - Screens/Components: `CompactTaskItem.tsx` (`/Users/yutosuzuki/code/samurai-agent/frontend/src/components/CompactTaskItem.tsx`)
  - Layout & Responsive: The status text label should appear within the `item-header` alongside the existing icon and title elements.
  - Visual Spec: Display the string value of `task.status` (e.g., 'PENDING', 'IN_PROGRESS', 'COMPLETED') as text.
Code Changes:
  - Frontend: Modify `frontend/src/components/CompactTaskItem.tsx` to either update an existing element or add a new `<span>` element for the status text.
Tests:
  - Unit/Integration: Add or update a test in `CompactTaskItem.test.tsx` to confirm the status text label is rendered in the header and contains the correct `task.status` string.
Acceptance Criteria:
  - The `CompactTaskItem` prominently displays the `task.status` as text (e.g., 'PENDING', 'IN_PROGRESS', 'COMPLETED') in its header area.
  - The displayed status text is contained within a distinct HTML element (e.g., `<span>`) that can be targeted by CSS using the `task-status-text-label` class.
```
