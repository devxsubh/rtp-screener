# RTP Global — VC Sanctions & Cap-Table Screener

A decision-support tool for venture firms. Upload a startup cap table (CSV) → screen every owner, including those hidden behind shell-company layers, against sanctions lists → receive a plain-English risk report with confidence scores.

**It never decides guilt.** It narrows the review set for a human compliance officer.

---

## Architecture

```
backend/   Express API (Node/TypeScript)  — port 3001
frontend/  Next.js app (React 19)         — port 3000
```

The only API endpoint is `POST /api/screen`. No database, no auth — stateless per-request processing.

### Backend flow

1. Parse CSV into ownership records
2. Build a directed ownership graph with [graphology](https://graphology.github.io/)
3. Traverse each chain (BFS + visited-set for circular ownership) to find ultimate beneficial owners
4. Screen every node against [Watchman](https://github.com/moov-io/watchman) — `GET /v2/search?name=&type=&minMatch=0.80`
5. Classify by top score: **clear** (<0.80) / **review** (0.80–0.95) / **flagged** (≥0.95)
6. For review + flagged nodes, call Claude Haiku (`claude-haiku-4-5`) to write a who/why/confidence/next-step narrative (server-side only — key never reaches the client)

### Frontend

- CSV upload box (drag-and-drop)
- Interactive ownership graph ([React Flow](https://reactflow.dev/)) — flagged nodes in red, ownership paths highlighted
- Risk table with clear/review/flagged badges and scores
- Expandable risk cards showing ownership chain, Watchman matches, and Claude's analyst notes

---

## Setup

### 1 — Watchman (sanctions data service)

```bash
docker run --rm -p 8084:8084 moov/watchman:static
```

Watchman loads OFAC SDN, EU Consolidated, and other lists on startup (~30 s).

### 2 — Environment

```bash
cp .env.example .env   # one file at repo root for backend + frontend
# Edit .env: ANTHROPIC_API_KEY, MONGODB_URI, JWT keys, etc.
pnpm install
pnpm dev               # starts both backend (:3001) and frontend (:3000)
```

**Root `.env` keys (see `.env.example` for full list):**

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Frontend → backend URL (default `http://localhost:3001`) |
| `PORT` | Backend port (default `3001`) |
| `FRONTEND_URL` | CORS origin (default `http://localhost:3000`) |
| `ANTHROPIC_API_KEY` | Required for Claude analyst notes |
| `MONGODB_URI` | MongoDB connection string |
| `WATCHMAN_URL` | Watchman base URL (default `http://localhost:8084`) |

Legacy `backend/.env` and `frontend/.env.local` still work as optional overrides, but **prefer editing root `.env` only**.

### 3 — Individual services (optional)

```bash
pnpm --filter vc-screener-backend dev   # backend only (:3001)
pnpm --filter rtp-global dev            # frontend only (:3000)
```

---

## CSV format

```csv
entity,entity_type,owner,owner_type,ownership_pct
AcmeTech Corp,company,Alpha Ventures LLC,company,35
Alpha Ventures LLC,company,Sarah Johnson,person,40
```

| Column | Values |
|--------|--------|
| `entity` | Name of the entity being owned |
| `entity_type` | `person` or `company` |
| `owner` | Name of the owning entity |
| `owner_type` | `person` or `company` |
| `ownership_pct` | Percentage (0–100) |

A sample file with two demo cases is at `backend/sample-data/sample-cap-table.csv`:
- **Johan Petrovitch Kozlov** — direct (1-level) owner via Gamma Holdings; fuzzy near-match name
- **Ivan Petrovich Kozlov** — hidden 3 levels deep (Beta Capital → Delta Trust → Coastal Finance); only the graph traversal surfaces this UBO

---

## Development notes

- If Watchman is not running, all entities return `clear` (no match = no hit — intentional safe default).
- Claude calls are server-side only; `ANTHROPIC_API_KEY` is never sent to the browser.
- The classifier thresholds (0.80 review, 0.95 flagged) live in `backend/src/lib/classify.ts`.
- The `minMatch` passed to Watchman is `0.80`; adjust in `backend/src/lib/watchman.ts`.
