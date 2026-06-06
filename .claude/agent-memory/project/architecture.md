---
name: architecture
description: RTP Global repo stack and agent tool loop entry points
metadata:
  type: project
---

RTP Global is a **VC cap-table sanctions screener** with a chat-first legal/compliance UI.

**Stack:** Express + MongoDB + Watchman + Claude (`backend/`), Next.js assistant shell (`frontend/`).

**Agent loop:** `POST /api/chat` → `runAgentWithTools` → `SCREENER_TOOLS` in `chatTools.ts`.

**Why:** Structured screening via tools; unstructured policy knowledge via planned RAG.

**How to apply:** When adding features, extend tools + assistant UI events before building parallel UIs. Read `CLAUDE.md` and `.claude/PROJECT.md` before large changes.
