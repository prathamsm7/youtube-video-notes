# DocuVision

Chat with YouTube videos and PDF documents using RAG (retrieval-augmented generation). Upload a PDF or paste a YouTube URL, wait for ingestion, then ask questions with streaming answers and citations.

For a visual architecture reference, see [docs/SYSTEM_MAP.md](docs/SYSTEM_MAP.md).

## Stack

- **Frontend / API:** Next.js 16, React 19, TypeScript
- **Orchestration:** LangGraph (ingest + query pipelines)
- **Database:** PostgreSQL via Prisma
- **Vector store:** Qdrant
- **LLM / embeddings:** OpenAI
- **PDF parsing:** Unstructured API
- **Reranking:** Jina
- **Background jobs:** Trigger.dev (eval workers)
- **Evaluation:** openevals (LLM-as-judge), LangSmith experiments
- **Optional:** Notion export (feature-flagged off by default), LangSmith tracing

## Prerequisites

- Node.js 20+
- PostgreSQL
- Qdrant (local Docker or cloud)
- API keys: OpenAI, Unstructured, Jina (see `frontend/.env.example`)

## Quick start

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with your credentials

npm install
npm run db:migrate      # apply Prisma migrations (dev)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, then upload a PDF or submit a YouTube URL.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing — upload PDF or paste YouTube URL |
| `/login`, `/signup` | Authentication |
| `/chats` | Chat history list |
| `/chat/[id]` | Active conversation (SSE streaming answers) |
| `/evals` | RAG evaluation dashboard (video golden sets) |
| `/notion-connect` | Notion OAuth callback (disabled unless feature flag is on) |

## Environment variables

Copy `frontend/.env.example` to `frontend/.env.local` and fill in:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Signs session cookies (long random string) |
| `OPENAI_API_KEY` | Yes | Chat, embeddings, query routing |
| `QDRANT_URL` | Yes | Vector database URL |
| `QDRANT_API_KEY` | Cloud only | Qdrant Cloud API key |
| `JINA_API_KEY` | Yes | Retrieval reranking |
| `UNSTRUCTURED_API_KEY` | Yes (PDF) | PDF partitioning |
| `GEMINI_API_KEY` | Notion only | Notion block conversion |
| `NOTION_OAUTH_*` | Notion only | OAuth integration |
| `LANGSMITH_*` | No | LLM tracing and eval experiments |
| `TRIGGER_SECRET_KEY` | Eval (prod) | Trigger.dev job dispatch |
| `TRIGGER_PROJECT_REF` | Eval | Trigger.dev project ref (default: `proj_docuvision`) |
| `EVAL_USE_INLINE_WORKER` | No | Set `true` to process eval jobs in-process |
| `EVAL_COOLDOWN_MS` | No | Delay between golden examples (default: 5000) |
| `EVAL_JUDGE_GAP_MS` | No | Delay between judge calls (default: 500) |
| `EVAL_WORKER_POLL_MS` | No | Poll interval for `eval:worker` (default: 3000) |

## Database migrations

This project uses **Prisma Migrate** (not `db push`).

| Command | When to use |
|---------|-------------|
| `npm run db:migrate` | Local development — creates/applies migrations |
| `npm run db:migrate:deploy` | CI / production — applies pending migrations only |
| `npm run db:studio` | Browse data in Prisma Studio |

Production `npm start` runs `prisma migrate deploy` before starting the server.

### First-time setup

If you have an existing database created with `db push`, either:

1. **Fresh database:** run `npm run db:migrate` on an empty DB, or  
2. **Existing schema:** mark the initial migration as applied:

```bash
cd frontend
npx dotenv -e .env.local -- prisma migrate resolve --applied 20250626120000_init
```

### Data models

| Model | Purpose |
|-------|---------|
| `User` | Accounts and sessions |
| `Video` / `Document` | Ingested sources (`PENDING` → `PROCESSING` → `READY` / `FAILED`) |
| `Chat` / `Message` | Conversations tied to one video or document |
| `EvalDataset` | Golden Q&A pairs per video or document |
| `EvalJob` / `EvalRun` | Background eval jobs and saved results |
| `NotionProfile` | Notion OAuth tokens (optional) |

Chunk embeddings are stored in **Qdrant** (per-source collections), not in Postgres.

## Authentication

Sessions use an **httpOnly cookie** (`docuvision_session`). The JWT is never stored in `localStorage` or returned in API responses.

Client requests use `credentials: "include"` so cookies are sent automatically.

## API reference

All protected routes require the session cookie. Ingest and chat message routes return **Server-Sent Events (SSE)** for progress and token streaming.

### Auth

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signup` | POST | Create account, set session cookie |
| `/api/auth/login` | POST | Sign in, set session cookie |
| `/api/auth/logout` | POST | Clear session cookie |
| `/api/auth/me` | GET | Current user |

### Chats

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chats` | GET | List user's chats |
| `/api/chats/[id]` | GET | Chat detail with source metadata |
| `/api/chats/[id]/messages` | GET | Message history |
| `/api/chats/[id]/messages` | POST | Send question, stream answer (SSE) |

### Source ingest

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sources/video/process/stream` | POST | Ingest YouTube video (SSE progress) |
| `/api/sources/document/process/stream` | POST | Ingest PDF upload (SSE progress) |

### Evaluation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/eval/jobs` | POST | Queue a background eval job |
| `/api/eval/jobs/active` | GET | Currently running or resumable job |
| `/api/eval/jobs/[id]` | GET | Job status and partial results |
| `/api/eval/jobs/[id]/resume` | POST | Resume a failed/cancelled job |
| `/api/eval/jobs/[id]/cancel` | POST | Request job cancellation |
| `/api/eval/runs` | GET | Past eval run history |
| `/api/eval/run` | POST | Run eval synchronously (blocking) |

Eval jobs run the video RAG pipeline against golden Q&A pairs in `EvalDataset`, score with LLM judges (correctness, groundedness, helpfulness, retrieval relevance, context recall), checkpoint progress, and sync experiments to LangSmith.

### Notion (feature-flagged)

Notion is **disabled by default** (`NOTION_FEATURE_ENABLED = false` in `frontend/src/lib/features.ts`). Set it to `true` to re-enable.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notion/auth` | POST | Start OAuth flow |
| `/api/notion/status` | GET | Connection status |
| `/api/notion/save-chat` | POST | Export chat to Notion |

## Evaluation workers

Eval jobs are dispatched via **Trigger.dev** when `TRIGGER_SECRET_KEY` is set. Otherwise they fall back to inline processing in the Next.js process.

**Local development options** (pick one):

```bash
# Option A: Trigger.dev dev worker (recommended)
npm run dev:trigger

# Option B: Inline worker (set in .env.local)
EVAL_USE_INLINE_WORKER=true

# Option C: Poll-based worker in a second terminal
npm run eval:worker
```

Run `npm run dev` in one terminal and one of the above in another for reliable background evals.

## Feature flags

| Flag | Location | Default | Effect |
|------|----------|---------|--------|
| `NOTION_FEATURE_ENABLED` | `src/lib/features.ts` | `false` | Hides Notion UI and returns 404 on Notion API routes |

## Project structure

```
frontend/
├── prisma/              # Schema and migrations
├── scripts/
│   └── eval-worker.ts   # Poll-based eval job worker
├── src/
│   ├── app/             # Next.js pages and API routes
│   ├── components/      # UI (docuvision/)
│   ├── context/         # Auth, chat list, theme, video player
│   ├── lib/
│   │   ├── chats/       # Chat persistence and SSE answer streams
│   │   ├── core/        # LLM handler, embeddings, reranker, Qdrant
│   │   ├── eval/        # Eval jobs, judges, LangSmith sync
│   │   └── sources/     # Video and document ingest + query pipelines
│   └── trigger/         # Trigger.dev task definitions
└── trigger.config.ts
```

## Scripts

From `frontend/`:

```bash
npm run dev              # Development server
npm run dev:trigger      # Trigger.dev dev worker (eval jobs)
npm run eval:worker      # Poll-based eval worker fallback
npm run build            # Production build
npm run start            # Migrate + start production server
npm run lint             # ESLint
npm run db:generate      # Regenerate Prisma client
npm run db:migrate       # Create/apply migrations (dev)
npm run db:migrate:deploy  # Apply pending migrations (CI/prod)
npm run db:studio        # Prisma Studio
```

## Vercel deployment

Set **Root Directory** to `frontend` in your Vercel project settings.

For eval jobs in production, configure `TRIGGER_SECRET_KEY` and deploy the Trigger.dev worker (`trigger.config.ts`).

## Qdrant (local)

```bash
docker run -p 6333:6333 qdrant/qdrant
```

Set `QDRANT_URL=http://localhost:6333` in `frontend/.env.local`.

## License

Private — all rights reserved.
