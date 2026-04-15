# Project Merge Guide: Next.js + FastAPI

This directory has been set up as a monorepo structure to house your combined project.

## Overview of the New Structure

```text
project/
├── package.json           <-- Root config to run both apps simultaneously
├── frontend/              <-- Your Next.js code goes here
│   ├── package.json
│   └── ...
└── backend/               <-- Your FastAPI code goes here
    ├── pyproject.toml
    ├── main.py
    ├── rag/
    ├── notion/
    └── utils/
```

## Step 1: Move Your Code

**For the Backend:**
1. Copy all your existing FastAPI files from your old backend folder (e.g., `youtube-rag`) into `project/backend/`.
2. Move your specific submodules into `project/backend/rag/`, `project/backend/notion/`, and `project/backend/utils/`.

**For the Frontend:**
1. Copy everything inside your existing Next.js folder and paste it into `project/frontend/`.

## Step 2: Ensure Dependencies Are Installed

**Root Dependencies:**
We will use `concurrently` to run both the frontend and backend servers together from a single command. In the `project/` directory, run:
```bash
npm install
```

**Frontend Dependencies:**
Navigate to the frontend folder and ensure Node modules are installed:
```bash
cd frontend
npm install
```

**Backend Dependencies:**
Navigate to the backend folder and install your Python dependencies:
```bash
cd backend
# Create a virtual environment if needed
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

## Step 3: Run Both Simultaneously

You no longer have to open two terminal windows. 
1. Open a terminal to the `project/` root directory.
2. Run the `dev` script:

```bash
npm run dev
```

This acts as a single command to spin up BOTH your Next.js application and your FastAPI server.

## Step 4: Connecting the Flow

To achieve your architecture diagram:
- Next.js fetches user's query and Notion token →
- Next.js acts as an API client, posting to `http://localhost:8000/ask` →
- FastAPI performs YouTube RAG and communicates with Notion API →
- FastAPI returns JSON directly to Next.js.

*(Take a look at `backend/main.py` where I set up scaffolding for your `/ask` endpoint).*
