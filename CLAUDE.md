# CLAUDE.md — RTP Global VC Sanctions & Cap-Table Screener

> **Claude Code:** Read `.claude/PROJECT.md` for platform capability map, custom agents, memory layout, and RAG roadmap. Slash commands live in `.claude/commands/`.

## Project Overview

A VC compliance tool that screens startup cap tables for sanctions risk. Users create "startups," upload cap-table CSVs, and get an AI-powered risk report with an ownership graph, entity risk table, and a Claude-generated plain-English narrative. The screener chat carries full context (CSV content + screening results) across all turns in a session.

**It never decides guilt.** It narrows the review set for a human compliance officer.

---

## Architecture

```
backend/   Express + TypeScript   — port 3001  (Node.js, MongoDB, Anthropic SDK)
frontend/  Next.js 15 + React 19  — port 3000  (Tailwind, Shadcn/ui, React Flow)
```

### Backend stack

- `express` with `helmet`, `cors`, `express-rate-limit`
- `@anthropic-ai/sdk` — Claude Haiku (`claude-haiku-4-5`) for analyst notes + agentic chat
- `mongoose` — MongoDB (local or Atlas), stores startups + cap-table CSVs
- `graphology` — directed ownership graph (BFS traversal, circular ownership detection)
- Watchman (Docker) — OFAC SDN + EU Consolidated sanctions screening via `GET /v2/search`

### Frontend stack

- Next.js 15 App Router, React 19, TypeScript
- Tailwind CSS + Shadcn/ui components
- `@xyflow/react` (React Flow) — interactive ownership graph
- `recharts` — data visualisation
- Supabase — optional auth (set env vars to enable; leave blank for preview mode)
- OpenNext / Cloudflare Workers — deployment target

---

## Key Data Flow

```
User uploads CSV
  → POST /api/startups/:id/csvs  (store raw CSV in MongoDB)
  → POST /api/chat (send with csvContent)
      → screen_cap_table tool:
          parseCapTable → buildOwnershipGraph → searchWatchman → classifyScore → explainMatch
      → returns ScreeningResult + Claude narrative
  → screeningResult saved back to startup in MongoDB (lastScreeningResult)
  → ScreeningResultsPanel opens: OwnershipGraph + RiskTable + RiskCards
```

---

## Dev Setup

### 1. Watchman (required — sanctions data)

```bash
docker run --rm -p 8084:8084 moov/watchman:static
# Takes ~30s to load SDN/EU lists. Must be running for any screening to work.
```

### 2. MongoDB

```bash
# Local:
mongod --dbpath /data/db
# Or use MONGODB_URI=mongodb+srv://... in root `.env`
```

### 3. Environment & dev server

```bash
cp .env.example .env    # monorepo root — backend + frontend
pnpm install            # installs all workspaces from root
pnpm dev                # starts backend + frontend together
```

Env vars (root `.env` — see `.env.example`):

| Variable | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3001` | Frontend → backend |
| `PORT` | `3001` | Express port |
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin |
| `ANTHROPIC_API_KEY` | — | Required for chat + explanations |
| *(model)* | `claude-haiku-4-5` | Locked in `backend/src/lib/llm/models.ts` — Haiku only |
| `MONGODB_URI` | `mongodb://localhost:27017/vc-screener` | Local or Atlas |
| `WATCHMAN_URL` | `http://localhost:8084` | Watchman Docker URL |

Legacy `backend/.env` / `frontend/.env.local` still override root if present; prefer root `.env` only.

> `pnpm dev` at the root starts both services. Individual: `pnpm --filter vc-screener-backend dev` or `pnpm --filter rtp-global dev`.

**Preview mode:** Set `ALLOW_PREVIEW_MODE=true` and `NEXT_PUBLIC_ALLOW_PREVIEW_MODE=true` in root `.env` for local dev without auth.

---

## Backend Source Map

```
backend/src/
  index.ts                  — Express app, rate limiters, route mounts
  routes/
    screen.ts               — POST /api/screen  (one-shot CSV screening, no chat)
    chat.ts                 — POST /api/chat    (agentic Claude chat with tool-use)
    startups.ts             — CRUD /api/startups + /api/startups/:id/csvs
  lib/
    parseCapTable.ts        — CSV → OwnershipRecord[]
    graph.ts                — buildOwnershipGraph, getAllNodes, getEdges, findOwnershipPath
    watchman.ts             — searchWatchman(name, type) → WatchmanMatch[]
    classify.ts             — classifyScore(topScore) → "clear"|"review"|"flagged"
    explain.ts              — explainMatch(node, matches, path, level) → Claude narrative
    runScreening.ts         — orchestrates parse→graph→watchman→classify→explain → ScreeningResult
    chatTools.ts            — SCREENER_TOOLS (Anthropic Tool[]) + createToolExecutor
    llm/
      claude.ts             — Claude API wrapper
      agent.ts              — runAgentWithTools (agentic loop with tool-use)
      index.ts              — re-exports
    db.ts                   — mongoose connect (singleton, lazy)
  models/
    startup.ts              — Startup mongoose schema (name, createdAt, lastScreeningResult)
    capTableCsv.ts          — CapTableCsv schema (startupId, filename, content, uploadedAt)
```

### Chat tool-use flow (`chat.ts` + `chatTools.ts`)

The `/api/chat` endpoint runs a Claude agent loop. Four tools are registered:

| Tool | When Claude calls it |
|---|---|
| `screen_cap_table` | User attaches a CSV and wants screening |
| `get_screening_summary` | User asks for counts or a summary |
| `get_entity_details` | User asks about a specific entity |
| `list_entities` | User wants filtered entity lists |

Context is carried per-request: the caller always sends `{ messages, screeningResult, csvContent }`. The handler injects these into the system prompt and the tool executor's context object.

---

## Frontend Source Map

```
frontend/src/
  app/
    (pages)/
      assistant/            — RTP Global compliance assistant (general + screener)
        page.tsx
        chat/[id]/page.tsx
      projects/
        page.tsx            — StartupsPage (list + create startups)
        [id]/page.tsx       — StartupScreenerPage (CSV strip + screener chat)
      screen/page.tsx       — Redirects to /assistant (unused — keep or wire up)
    components/
      screen/               — All screener UI
        ScreenerInitialView.tsx   — Landing view (animated logo + chat input)
        ScreenerChatView.tsx      — Active chat: messages + side panel toggle
        ScreenerChatInput.tsx     — Textarea + CSV file attach button
        ScreenerAssistantMessage.tsx
        ScreeningResultsPanel.tsx — Side panel: graph + risk table + risk cards
        OwnershipGraph.tsx        — React Flow graph (flagged=red, review=yellow)
        RiskTable.tsx             — Entity risk table
        RiskCard.tsx              — Individual flagged/review entity card
        chatTypes.ts              — ScreenerMessage, AssistantEvent types
      startups/
        StartupsPage.tsx          — Startup list with create/delete
        StartupScreenerPage.tsx   — Per-startup: CSV strip + screener chat
      assistant/            — General assistant components (not screener)
      shared/               — AppSidebar, DocPanel, etc.
    hooks/
      useScreenerChat.ts    — Core screener state: messages, screeningResult, csvRef
                              Carries context across all turns in a session
    lib/
      screenerApi.ts        — sendChatMessage, screenCapTable (fetch wrappers)
      rtpGlobalApi.ts       — RTP Global API (projects, chats, documents)
  lib/
    screenerTypes.ts        — ScreeningResult, EntityResult, OwnershipEdge types
    startupsApi.ts          — listStartups, createStartup, listCsvs, saveCsv, etc.
    supabase.ts             — Supabase client
    uiPreview.ts            — UI_PREVIEW_MODE flag
```

### Context carryover in `useScreenerChat`

- `csvRef` (useRef) — holds raw CSV text across turns; passed as `csvContent` to every chat request
- `screeningResult` (useState) — updated when backend returns a new result; passed back each turn
- After a new `screeningResult` arrives → save it to the startup record via `startupsApi` → panel auto-opens
- On startup page load → fetch stored `lastScreeningResult` from MongoDB → inject as initial state

---

## Routing

| URL | Component | Notes |
|---|---|---|
| `/startups` | `StartupsPage` | List + create startups |
| `/startups/:id` | `StartupScreenerPage` | CSV strip + full screener chat |
| `/assistant` | RTP Global compliance assistant | Primary chat shell |
| `/assistant/chat/:id` | Persisted chat view | |
| `/screen` | Redirects → `/assistant` | Unused |

The sidebar shows "Startups" → `/startups` and "Recent Projects" (up to 5).

---

## Sample Data

`backend/sample-data/sample-cap-table.csv` — canonical cap table (strict 5-column format).

`backend/sample-data/sample-entity-roster.csv` — flat entity list for roster screening mode.

**CSV ingest** (`backend/src/lib/csvIngest.ts`): strict → heuristic column aliases → Claude schema inference. Supports cap tables (varied column names) and entity rosters. Reference/metadata files (e.g. OpenSanctions sources catalogs) are blocked with guidance. Required fields: cap table needs `entity`, `owner`, `ownership_pct`; roster needs `name`. Watchman matching stays deterministic — AI only maps columns, never decides hits.

---

## Claude Code / platform parity

| Capability | Status | Command / doc |
|---|---|---|
| Agent tool loop | ✅ | `backend/src/lib/llm/agent.ts` |
| Persistent agent memory | ✅ seeded | `.claude/agent-memory/project/` |
| Document RAG | 🔲 planned | `/compliance-rag-roadmap` |
| Chat-first UI shell | ✅ restored | `frontend/.../assistant/` |
| Gap audit | — | `/compliance-parity-check` |

---

## What's Next (Pending Implementation)

See the plan in conversation context for full details. Short version:

1. **Persist `lastScreeningResult` per startup** — Startup model already has the field; need backend PATCH to save it and frontend to call it after screening
2. **Restore graph on page load** — `useScreenerChat` needs `initialScreeningResult` param; `StartupScreenerPage` fetches it on mount
3. **Follow-up chat against stored result** — falls out of 1+2 for free
4. **Fix `/screen` standalone route** — wire `useScreenerChat` directly or remove the redirect

---

## Common Commands

```bash
# Root (pnpm workspace)
pnpm install                        # install all workspaces
pnpm dev                            # start backend + frontend in parallel
pnpm -w run typecheck               # backend tsc --noEmit
pnpm -w run lint                    # frontend eslint

# Backend only
pnpm --filter vc-screener-backend run dev
pnpm --filter vc-screener-backend run build
pnpm --filter vc-screener-backend run typecheck

# Frontend only
pnpm --filter rtp-global run dev
pnpm --filter rtp-global run build
pnpm --filter rtp-global run lint

# Watchman (Docker)
docker run --rm -p 8084:8084 moov/watchman:static
```

## TypeScript / Lint Notes

- Backend: strict TypeScript via `tsc`. No `any` casts without reason.
- Frontend: Next.js ESLint config. `pnpm -w run lint` runs before every commit via Husky.
- Do not use `console.log` in production paths — backend uses `console.log` only for startup messages.
