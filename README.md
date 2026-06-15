# Cloutwatch

**Creator Investment Intelligence Platform**

Next.js dashboard for creator partnership teams : ROI analytics, multi-agent AI workflows, meeting intelligence, and client comms via Gmail. Role-separated employee and brand client experiences behind Google OAuth.

---

## What It Does

| Module | Route | Summary |
|---|---|---|
| **ROI Analyzer** | `/roi-analyzer` | KPIs, Recharts, creator ranking from CSV data |
| **Creator Picks** | `/roi-analyzer/agents` | Scout → Risk → Strategist AI pipeline (NDJSON stream) |
| **Meeting Notes** | `/meeting-notes` | Paste notes → AI extracts decisions, tasks, themes |
| **Pre-Meeting Brief** | `/pre-meeting-brief` | Performance deltas + AI meeting brief |
| **Brand Portal** | `/brand-portal` | Read-only client view (KPIs, charts, digest feed) |
| **Data Upload** | `/upload` | CSV drag-and-drop with 18-column validation |
| **Notifications** | Sidebar drawers | Weekly digests + red-flag alerts via Gmail |

---

## Roles

| Role | Routes | Data |
|---|---|---|
| `employee` | All internal tools + notification drawers | Full dataset |
| `client` | `/brand-portal` only | Filtered to `session.user.brand` |

Login: pick Employee or Brand on `/login` → Google OAuth → JWT with role + brand. User profiles and brand mapping live in `lib/users.ts`.

---

## Architecture

```
Browser (React + Recharts)
        │ HTTP / NDJSON
Next.js API Routes (app/api/*)
        │
   ┌────┴────┐
Claude      Google OAuth + Gmail
(opus-4-6)  (NextAuth JWT)
        │
In-memory stores (globalThis)
dataStore · meetingStore · notificationStore · digestStore
```

**No database.** All server state is in-memory — lost on restart. Agent outputs persist in browser `localStorage` only.

**Auth flow:** `/login` → set `login-as` cookie → Google OAuth → JWT populated with role/brand → cookie cleared.

**Middleware** protects employee + client routes. Clients blocked from employee pages → `/brand-portal`. Employees blocked from portal → `/roi-analyzer`.

---

## AI Agents

Model: `claude-opus-4-6` · SDK: `@anthropic-ai/sdk` · Data to Claude: markdown tables from CSV rows

| Agent | Job | Output |
|---|---|---|
| **Scout** | Rank creators, tier mix, watch list | Top 5 table + recommendations |
| **Risk** | Flag anomalies, brand safety | GREEN/AMBER/RED per creator + campaign score |
| **Strategist** | Final investment brief | Budget split, EMV range, talking points |

Pipeline: `POST /api/agents` streams NDJSON events (`scout` → `risk` → `strategy` → `complete`).

RED flags auto-create sidebar alerts + optional Gmail alert to brand client.

Other AI routes: `POST /api/meetings` (note extraction), `POST /api/brief` (pre-meeting brief). Legacy `POST /api/analyze` exists but is not wired to UI.

---

## Key Metrics & Scoring

| Metric | Meaning |
|---|---|
| **EMV** | Earned media value ($) |
| **CPE** | Cost per engagement — lower is better |
| **Eng Rate** | Engagement rate (%) |
| **Sentiment** | Score 0–1 |
| **Brand Fit** | Historical alignment (0–10) |
| **Fake Follower Flag** | Boolean — −15 penalty in ranking |

**Composite ranking score:**
```
eng_rate×0.30 + norm(EMV)×0.25 + norm(CPE inverted)×0.20
+ sentiment×100×0.15 + brand_fit×10×0.10 − (fake_flag ? 15 : 0)
```

KPI deltas compare current vs `prev_*` columns. CPE uses inverted positive logic.

---

## Project Structure

```
app/
├── page.tsx                  # Command Center
├── login/                    # Role selection + Google sign-in
├── upload/                   # CSV upload
├── roi-analyzer/             # ROI dashboard + /agents (Creator Picks)
├── meeting-notes/            # Note extraction
├── pre-meeting-brief/        # Brief generation
├── brand-portal/             # Client read-only portal
└── api/                      # All server routes (see API table above)

components/
├── layout/                   # AppShell, Sidebar, TopBar
├── agents/                   # CreatorAgentWorkflow
└── ui/                       # PageHeader, AnalysisCard, ErrorCard, EmailChipSelector

lib/
├── auth.ts · users.ts        # NextAuth + role resolution
├── agents.ts                 # Scout/Risk/Strategist runners
├── dataStore.ts              # In-memory creator data
├── meetingStore.ts           # Meeting notes
├── notificationStore.ts      # Digests + red flags
├── digestStore.ts            # Sent digest history
├── gmail.ts                  # Email templates + Gmail send
└── anthropicServer.ts        # API key helper

middleware.ts                 # Auth gating + role redirects
public/mock_campaigns.csv     # Default sample dataset
.env.example                  # Env template (never commit .env.local)
```

---

## Concepts Touched

| Concept | Where It Shows Up |
|---|---|
| **End-to-End AI System Architecture** | CSV data → markdown table serialization → sequential agent pipeline → NDJSON stream → live UI rendering → red-flag side effects → Gmail alerts; same pattern for notes extraction and pre-meeting briefs |
| **Multi-Agent AI Orchestration** | Scout → Risk → Strategist pipeline in `/api/agents`, each with its own system prompt and output schema |
| **LLM Integration (Claude)** | Meeting extraction, pre-meeting briefs, creator ranking analysis via Anthropic SDK |
| **Prompt Engineering** | Role-specific system prompts per agent; structured markdown + JSON output contracts |
| **NDJSON Streaming** | Agent pipeline streams progressive events to the UI without waiting for full completion |
| **OAuth 2.0 & JWT Sessions** | Google sign-in, token refresh, role/brand embedded in JWT via NextAuth |
| **Role-Based Access Control (RBAC)** | Employee vs client route gating in middleware + API session checks |
| **In-Memory Singleton Stores** | `globalThis`-backed stores for creator data, notes, digests, and alerts |
| **Composite Scoring** | Weighted creator ranking formula across engagement, EMV, CPE, sentiment, and brand fit |
| **Period-over-Period Analytics** | KPI deltas comparing current campaign metrics vs `prev_*` columns |
| **HTML Email Templating** | Branded weekly digest and red-flag alert emails sent via Gmail API |
| **CSV Ingestion & Validation** | Client-side PapaParse upload with 18-column schema enforcement |
| **Interactive Data Visualization** | Recharts scatter, bar, and ranking charts with click-to-insight readouts |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 App Router, React 18, TypeScript 5 |
| AI | Anthropic SDK — `claude-opus-4-6` |
| Auth | NextAuth.js 4 + Google OAuth (JWT, token refresh) |
| Email | Google Gmail API via `googleapis` |
| CSV | PapaParse |
| Charts | Recharts 3 |
| Styling | Tailwind CSS 3.4 + `@tailwindcss/typography` |
| Fonts | Space Grotesk (UI) · JetBrains Mono (labels/nav) |

---

## API Routes

| Route | Methods | Purpose |
|---|---|---|
| `/api/auth/[...nextauth]` | GET, POST | Google OAuth + JWT sessions |
| `/api/auth/login-as` | POST | Set pre-OAuth role cookie |
| `/api/data` | GET | Creator dataset (brand-filtered for clients) |
| `/api/upload` | POST, DELETE | Store / clear uploaded CSV |
| `/api/agents` | POST | Multi-agent pipeline (NDJSON stream) |
| `/api/meetings` | GET, POST, DELETE | Meeting notes CRUD + AI extraction |
| `/api/brief` | POST | Pre-meeting brief generation |
| `/api/notifications` | GET, PATCH, DELETE | Pending digests + red-flag alerts |
| `/api/digests` | GET | Sent digest history (brand portal) |
| `/api/email/weekly` | POST | Send weekly digest via Gmail |
| `/api/email/redflag` | POST | Send red-flag alert via Gmail |
| `/api/emailbook` | GET, POST, PATCH, DELETE | Saved email recipients |
| `/api/cron/weekly` | GET | Queue digests per brand (`x-cron-secret` header) |

---

## Data & Storage

| Store | File | Contents |
|---|---|---|
| Creator data | `lib/dataStore.ts` | CSV rows (upload or mock fallback) |
| Meeting notes | `lib/meetingStore.ts` | AI-extracted notes |
| Notifications | `lib/notificationStore.ts` | Pending/sent digests + red flags |
| Sent digests | `lib/digestStore.ts` | Digest history for brand portal |
| Email book | `lib/emailBook.ts` | Saved recipient addresses |

Priority: uploaded CSV → `public/mock_campaigns.csv`. Seeds demo data on boot via `seedNotifications()` + `seedRedFlags()`.

---

## Design System

Dark terminal aesthetic — near-black backgrounds, neon green accent (`#1aff66`), semantic red/amber for risk states.

| Token | Usage |
|---|---|
| `bg-base` / `bg-card` | Page / card backgrounds |
| `green-primary` | Accent, active nav, CTAs |
| `red-flag` / `amber-warn` | Risk badges, warnings |
| Space Grotesk | Body + headings |
| JetBrains Mono | Nav, badges, KPI labels |

Layout: 220px fixed sidebar · 480px slide-in notification drawers · `ml-[220px] pt-24` main content offset.

---

## License

Private project. All rights reserved.
