# PRD — VC Sanctions & Cap-Table Screener

**Working name:** Sentinel (placeholder)
**Author:** Subham
**Status:** Draft for case-study submission
**Last updated:** June 2026

---

## 1. Summary

A decision-support capability embedded inside a legal-AI workspace for a lean venture firm. An associate uploads a startup's cap table; the system screens every owner — including individuals hidden behind layers of holding companies — against global sanctions lists, and returns both a structured grid and a narrative report the user can interrogate in chat.

It does not decide guilt. It surfaces the few entities a person must review, with evidence and a confidence score, and converts a rare, error-prone manual check into continuous, auditable coverage.

**Key design shift:** this is not a standalone app. It plugs into an existing workspace with four surfaces — **Assistant** (centralized chat), **Startups** (per-deal workspaces), **Tabular Review** (grid analysis), and **Workflows** (reusable, saved analyses). The screener is delivered as a screening **tool** plus two saved **workflows** — one prompt-type and one tabular-type — surfaced across those four places.

---

## 2. Problem

A globally operating VC must be certain that no sanctioned individual or entity sits in the ownership of a company it funds, or in its co-investors and vendors. Getting this wrong is existential: frozen assets, regulatory penalties, reputational damage.

Three things make this hard today:

1. **It's manual and error-prone.** Names are checked by hand against lists, with no systematic handling of spelling variants, aliases, or transliteration.
2. **Shell structures hide the real owner.** A flat name-check screens the names on the cap table; the actual risk is a sanctioned person sitting three holding companies deep, which manual review routinely misses.
3. **It's point-in-time.** A party clean at closing can be sanctioned later, and nobody re-checks the existing portfolio.

**Regulatory trigger:** As of January 1, 2026, FinCEN formally mandates AML/KYC screening — including OFAC and PEP checks — for Exempt Reporting Advisers and Registered Investment Advisers. This moved sanctions screening from best practice to legal obligation for firms structured as ERAs.

---

## 3. Who it's for

- **Primary:** the associate / compliance person who runs the check before an investment is finalized.
- **Secondary:** partners (who need confidence the gate was cleared) and the Chief Compliance Officer (who owns the audit trail and regulatory filings).

---

## 4. Goals & non-goals

**Goals**
- Catch matches a manual check misses, especially owners hidden behind shell layers.
- Reduce false positives to a reviewable handful per cap table.
- Present results both as a reviewable grid and as an interrogable narrative.
- Produce an auditable record of who reviewed what and when.
- Be honest about uncertainty — surface confidence, never a verdict.

**Non-goals**
- Not a replacement for legal counsel or a regulator-grade compliance system.
- Not an automated decision-maker — it never clears or condemns anyone.
- Not a deal-evaluation tool — it makes no judgment about investment quality.

---

## 5. Core principle

> The tool is decision-support. Matching is deterministic and explainable; the AI only narrates. A human always makes the final call.

This resolves the central risk: a VC will never trust a prototype to *decide* compliance, but will happily use one that *narrows the haystack* with evidence. It also dictates the architecture — see Section 9. The grid reinforces it: the machine fills the findings columns, a human fills the final Status column.

---

## 6. Value framing

This is not primarily an efficiency tool. Manual screening is only a few hours per deal, so direct time saved is modest (roughly 20–60 hours/year at the deal gate for a firm doing 20–40 deals annually).

The real value is twofold:
- **Risk avoided** — the single missed match it prevents is worth more than all the hours saved.
- **Coverage created** — continuous portfolio monitoring (delivered via the tabular grid) is work that simply was not happening manually before.

When stating ROI: lead with risk reduction and coverage, not hours.

---

## 7. UX — how it lives in the four surfaces

The product is chat-first as an *entry point* and an *interrogation layer*, but heavy analysis renders as a structured view (grid + graph) with chat always alongside it. Each surface has a distinct job.

### 7.1 Startups tab — the per-deal workspace (the heavy lifting)
Each startup is a project holding its cap-table CSV and documents. The associate uploads the CSV here and runs the screen scoped to *that* startup. The result — risk grid + interactive ownership graph — lives in the workspace permanently.

A persistent chat sits beside the structured result, **scoped to this startup**: it already knows the analysis, so the user can ask "why is BVI HoldCo flagged?", "show the path to the ultimate owner", or "what's the next step here?" without re-explaining context.

Pattern: **structured result on one side, persistent chat on the other, both looking at the same analysis.** Chat explains the report; it does not replace it.

### 7.2 Assistant tab — the centralized brain with @-mentions
The global chat can pull any startup's completed analysis into context via `@startup`. This enables portfolio-level questions no single workspace can answer:
- "Compare sanctions risk across `@AcmeAI` and `@BetaCorp`."
- "Which of my flagged startups share a common ultimate owner?"
- "Summarize all open compliance flags across the portfolio."

The @-mention is the bridge between per-deal work and portfolio-level thinking.

### 7.3 Tabular Review — the grid (review + frequency unlock)
Tabular review is a grid where rows are entities and columns are checks. Two applications:

- **Single cap table as a grid:** rows = each owner/entity; columns defined by the tabular workflow (Section 7.4). The analyst sees all entities at once and sorts flagged to the top.
- **Whole portfolio as a grid (the dashboard):** rows = portfolio companies; columns = `Last screened` / `Open flags` / `Highest-risk entity` / `Co-investor risk` / `Status`. Re-run weekly → the always-on monitoring view that turns a rare-use gate into a surface someone opens regularly.

This surface is the single biggest lever for usage frequency.

### 7.4 Workflows — two reusable types
A workflow is a reusable, saved analysis attached to the Assistant or run on demand. There are **two types**, and the screener ships one of each:

**(a) Prompt-type workflow — "Cap Table Sanctions Screen."**
A saved prompt (speech-bubble type) that produces the *narrative* analysis. It calls the screening tool, then narrates flagged vs. cleared entities in prose. Used for explanation and chat interrogation.

**(b) Tabular-type workflow — "Cap Table Sanctions Review."**
A saved *column schema* (grid type) that produces the *reviewable grid*. The user defines the columns once and every entity renders as a row. Proposed schema:

| Column | Type |
|---|---|
| Entity | Free Text |
| Type (person / company) | Free Text |
| Ultimate Owner? | Free Text (yes/no) |
| Ownership Path | Free Text |
| Sanctions Match | Free Text |
| Match Score | Free Text / Number |
| Source List | Free Text |
| Risk | Free Text (Clear / Review / Flagged) |
| Status | Free Text — left blank for the human to fill |

The blank Status column mirrors the existing "Generate CP Checklist" pattern (machine fills findings, human fills the decision), keeping the core principle visible in the schema itself.

The two types are complementary: the **prompt** answers "*explain* this cap table's risk"; the **tabular** answers "*show me every entity at once* so I can review and sign off." Both are authored the way the product already supports, so neither is custom UI.

---

## 8. Features

### 8.1 Must-have (v1 — build for the case study)

**F1 — Cap-table upload & parsing**
Accept a CSV of entities and ownership in a startup workspace. Validate structure, surface parse errors clearly.

**F2 — Beneficial-ownership graph & ultimate-owner traversal** *(the core differentiator)*
Build a directed ownership graph and walk each chain to the ultimate beneficial owner behind holding-company layers. Handle circular ownership with cycle protection. Catches the hidden owner a flat check misses.

**F3 — Sanctions screening tool (`screen_cap_table`)**
A deterministic tool that screens every node (not just top-level names) against OFAC / UN / CSL via fuzzy and alias matching, and runs the ownership traversal. Configurable match threshold. *(Built on the open-source Watchman engine rather than reinventing matching.)* This is the tool both workflows depend on.

**F4 — Risk classification**
Score each result and bucket it clear / review / flagged. Conservative thresholds so the tool flags few entities confidently.

**F5 — "Cap Table Sanctions Screen" workflow (prompt-type)**
A saved prompt that calls `screen_cap_table`, then narrates: for flagged entities — who matched, why, confidence, ownership path, next step; for cleared entities — confirm what was checked so clearance is auditable. Flagged-vs-cleared logic lives inside this single prompt.

**F6 — "Cap Table Sanctions Review" workflow (tabular-type)**
A saved column schema (Section 7.4) that renders every entity as a row with findings columns plus a blank Status column for human sign-off.

**F7 — Structured result + persistent chat (Startups tab)**
Results render as the grid + ownership graph in the startup workspace, with a scoped chat alongside for interrogation.

**F8 — Audit log**
Record every flag and every human review decision (who, when, outcome), establishing the auditable trail compliance requires.

### 8.2 High-value next

**F9 — Portfolio screening grid (tabular)** *(highest-impact for frequency)*
A portfolio-level tabular view (rows = companies). Re-run on a schedule for continuous, always-on coverage. This is what makes the tool everyday infrastructure rather than a per-deal gate.

**F10 — Assistant @-mention of startups**
Pull any startup's completed analysis into the centralized chat for cross-portfolio questions.

**F11 — "IC Compliance Memo" workflow (prompt-type)**
A saved prompt that turns a screening result into the investment-committee memo, chaining naturally after the screen.

**F12 — Continuous re-screening + alert digest**
Re-run the portfolio against fresh lists on a schedule; push a Slack/email summary ("3 new flags this week").

**F13 — Co-investor & vendor screening**
Extend screening beyond cap tables to co-investing firms and major portfolio vendors — more entities, more recurring use.

### 8.3 Future / scaffolded (roadmap, don't build)

**F14 — Additional lists** — EU and UK consolidated lists (currently disabled in the engine version used).
**F15 — Real-world ownership ingestion** — parse messy real cap-table documents (PDF, registry data) into the graph automatically.
**F16 — Periodic re-attestation** — quarterly review-and-sign-off tied to SEC / Form ADV cadence.
**F17 — Adverse-media screening** — search news for borderline entities to add context to flags.

---

## 9. Architecture

The product surfaces are provided by the existing workspace. The new engineering is a screening tool, two saved workflows (a prompt and a column schema), and the ownership-graph logic.

**Division of labor (the engineering story):**

| Layer | Who built it | Role |
|---|---|---|
| Sanctions matching engine (Watchman) | Open source | Fuzzy/alias matching over OFAC/UN/CSL |
| **Ownership graph + ultimate-owner traversal** | **Built here** | **Resolves hidden owners behind shells — the core signal** |
| `screen_cap_table` tool | Built here | Deterministic: calls Watchman + runs the graph, returns entities/scores/paths/flags |
| "Cap Table Sanctions Screen" prompt workflow | Built here | Calls the tool; narrates flagged vs. cleared |
| "Cap Table Sanctions Review" tabular workflow | Built here | Column schema; renders entities as rows for sign-off |
| Assistant / Startups / Tabular / Workflows | Existing workspace | The surfaces the tool and workflows appear in |
| AI narration | Orchestrated here | Explains results; never decides matches |

**Flow of one screen:** upload CSV in a startup workspace → run a workflow → it calls `screen_cap_table` → tool parses CSV, builds ownership graph, resolves ultimate owners, screens every node, classifies → prompt workflow narrates, or tabular workflow fills the grid → result renders with chat alongside → optionally surfaced portfolio-wide and chainable into IC Compliance Memo.

**Data-source note (to confirm in product):** existing tabular workflows extract columns *from an uploaded document*. The cap-table grid's findings columns (Match Score, Risk) come from the screening *tool's output*, not from reading prose. Confirm whether a tabular workflow can be populated by a tool/result; if it is document-only, the grid can self-fill basic columns (Entity, Type, Ownership) but needs the tool wired in for the screening columns.

**Hard rule:** matching is deterministic (the tool); the AI narrates only. Never ask the model "is this person sanctioned?"

---

## 10. Success metrics

**For the prototype (what to demonstrate)**
- Correctly flags a fuzzy near-match despite a misspelling.
- Correctly surfaces an owner hidden three layers deep that a flat check would clear.
- Flags only the planted risks on the sample — no false-positive flood.
- Produces both a clear grid and a human-readable explanation per flag, interrogable in chat.

**For a production version (what to measure)**
- Reduction in entities a human must manually review per cap table.
- New hits caught by continuous monitoring that point-in-time checks would have missed.
- False-positive rate kept to a reviewable level.
- Completeness of the audit trail for regulatory filing.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| False-positive flood undermines trust | Conservative match threshold; tune on sample data |
| Tool appears to "decide" compliance | Strict decision-support framing; blank Status column for human sign-off |
| AI hallucinates a verdict | Matching is deterministic; AI narrates only |
| Looks like a rebrand of a legal product | Demo centers the new engineering (screening tool + ownership graph), not the generic legal workflows |
| Demo looks staged | Graph finding a *hidden* owner is logic, not a plant — lean on it |
| Over-claiming accuracy | Position as narrowing the review set, not regulator-grade |
| Sensitive framing | Standard global multi-jurisdiction compliance, never origin-based |
| Tabular can't be tool-backed | Confirm early; fall back to document-self-fill columns + prompt workflow for findings |
| Scope creep eats the deadline | Build the tool + two workflows on sample data; the workspace already exists |

---

## 12. Scope for the case study — what's real vs. scaffolded

**Real & working:** CSV upload in a startup workspace, ownership graph traversal, `screen_cap_table` tool (OFAC/UN/CSL), classification, both workflows (prompt + tabular), structured result + scoped chat, basic audit log.

**On sample data:** the cap table (real ones are private — clearly stated), with two planted demo cases: a fuzzy near-match name, and a sanctioned-style owner hidden three levels deep so only the graph finds it.

**Scaffolded / roadmap:** portfolio-wide grid, Assistant @-mention, IC Compliance Memo chaining, continuous monitoring, EU/UK lists, real-document ingestion, persistent database.


