# DocuVision

Chat with YouTube videos and PDF documents using RAG (retrieval-augmented generation). Upload a PDF or paste a YouTube URL, wait for ingestion, then ask questions with streaming answers and citations.

## Stack

- **Frontend / API:** Next.js 16, React 19, TypeScript
- **Database:** PostgreSQL via Prisma
- **Vector store:** Qdrant
- **LLM / embeddings:** OpenAI
- **PDF parsing:** Unstructured API
- **Reranking:** Jina
- **Optional:** Notion export, LangSmith tracing

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

## Environment variables

Copy `frontend/.env.example` to `frontend/.env.local` and fill in:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Signs session cookies (long random string) |
| `OPENAI_API_KEY` | Yes | Chat, embeddings, query routing |
| `QDRANT_URL` | Yes | Vector database URL |
| `JINA_API_KEY` | Yes | Retrieval reranking |
| `UNSTRUCTURED_API_KEY` | Yes (PDF) | PDF partitioning |
| `GEMINI_API_KEY` | Notion only | Notion block conversion |
| `NOTION_OAUTH_*` | Notion only | OAuth integration |
| `LANGSMITH_*` | No | LLM tracing |

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

## Authentication

Sessions use an **httpOnly cookie** (`docuvision_session`). The JWT is never stored in `localStorage` or returned in API responses.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signup` | POST | Create account, set session cookie |
| `/api/auth/login` | POST | Sign in, set session cookie |
| `/api/auth/logout` | POST | Clear session cookie |
| `/api/auth/me` | GET | Current user (requires cookie) |

Client requests use `credentials: "include"` so cookies are sent automatically.

## Project structure

```
frontend/
├── prisma/           # Schema and migrations
├── src/
│   ├── app/          # Next.js pages and API routes
│   ├── components/   # UI (docuvision/)
│   ├── context/      # Auth, chat list, theme
│   └── lib/
│       ├── chats/    # Chat persistence and SSE streams
│       ├── core/     # LLM handler, RAG utilities
│       └── sources/  # Video and document ingest + query pipelines
```

## Scripts

From `frontend/`:

```bash
npm run dev              # Development server
npm run build            # Production build
npm run start            # Migrate + start production server
npm run lint             # ESLint
npm run db:generate      # Regenerate Prisma client
```

## Vercel deployment

Set **Root Directory** to `frontend` in your Vercel project settings.

## Qdrant (local)

```bash
docker run -p 6333:6333 qdrant/qdrant
```

Set `QDRANT_URL=http://localhost:6333` in `frontend/.env.local`.

## License

Private — all rights reserved.
