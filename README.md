# Creator IQ — Creator Investment Intelligence Platform

Creator IQ is an AI-powered internal tool built for teams that manage creator/influencer partnerships. Instead of manually pulling data and writing briefs, the platform sends your creator data to specialized AI agents that analyze ROI, summarize meeting notes, and generate pre-meeting intelligence — all in one place.

---

## What Problem Does This Solve?

Managing creator partnerships involves a lot of repetitive, context-heavy work:
- Estimating whether a creator deal is worth the investment
- Pulling action items out of long call recordings or notes
- Researching a creator before a meeting

Creator IQ automates each of these tasks using dedicated AI agents powered by Claude (Anthropic's LLM), surfacing the right intelligence at the right moment.

---

## The Three AI Modules (Agents)

Each module in the platform is backed by a separate AI agent with a specific job:

| Module | Agent's Job | What You Get |
|---|---|---|
| **ROI Analyzer** | Takes creator performance data (CSV upload) and models projected return on investment | Revenue forecasts, risk scores, investment recommendations |
| **Meeting Notes** | Processes raw call notes or transcripts | Structured list of decisions made, risks flagged, and follow-up actions |
| **Pre-Meeting Brief** | Pulls creator context before a scheduled call | A one-page brief: audience profile, past performance, talking points |

### Why Multi-Agent?

Each module is a separate agent rather than one monolithic AI call because:
- **Separation of concerns** — the ROI agent is tuned for quantitative analysis; the notes agent is tuned for information extraction; the brief agent is tuned for synthesis and summarization.
- **Independent context windows** — each task gets its own focused prompt and tools without interference from unrelated tasks.
- **Modular development** — agents can be improved, replaced, or swapped independently.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Next.js UI)                  │
│                                                          │
│   Sidebar Nav → Upload → ROI Analyzer                    │
│                       → Meeting Notes                    │
│                       → Pre-Meeting Brief                │
└────────────────────────┬────────────────────────────────┘
                         │  HTTP requests
┌────────────────────────▼────────────────────────────────┐
│              Next.js API Route Handlers                  │
│              (app/api/* — server-side)                   │
│                                                          │
│   /api/analyze   → ROI Agent                             │
│   /api/meetings  → Notes Extraction Agent                │
│   /api/brief     → Brief Generation Agent                │
│   /api/upload    → CSV ingestion                         │
│   /api/data      → Creator dataset                       │
└────────────────────────┬────────────────────────────────┘
                         │  Anthropic SDK calls
┌────────────────────────▼────────────────────────────────┐
│                  Claude (Anthropic API)                  │
│                                                          │
│   Each agent runs with its own:                          │
│   - System prompt (defines its role and output format)   │
│   - Tool definitions (structured data extraction)        │
│   - User message (the uploaded data or pasted notes)     │
└─────────────────────────────────────────────────────────┘
```

**Data flow for a typical interaction:**
1. User uploads a CSV of creator metrics via `/upload`
2. PapaParse parses the CSV client-side
3. Parsed data is sent to the relevant API route
4. The API route calls Claude with a structured prompt + data
5. Claude's response is returned and rendered using Recharts (for charts) or as structured text

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Framework** | Next.js 14 (App Router) | File-based routing, server components, API routes in one codebase |
| **Language** | TypeScript | Type safety across frontend and API layer |
| **AI / LLM** | Anthropic Claude (via `anthropic` SDK) | Powers all three analysis agents |
| **Styling** | Tailwind CSS | Utility-first, fast to iterate on dark-themed UI |
| **Data Parsing** | PapaParse | CSV uploads from creator data exports |
| **Charts** | Recharts | ROI projections and performance visualizations |
| **Auth (planned)** | NextAuth.js + Google OAuth | Team login |
| **Fonts** | Space Grotesk (sans) + JetBrains Mono (mono) | Technical, terminal-style aesthetic |

---

## Project Structure

```
creator-iq/
├── app/
│   ├── layout.tsx                # Root layout — wraps all pages with the sidebar
│   ├── page.tsx                  # Home / Command Center — links to all three modules
│   ├── globals.css               # Global styles and CSS variables
│   └── api/
│       ├── analyze/route.ts      # ROI Agent — AI recommendation generation
│       ├── meetings/route.ts     # Notes Agent — meeting note storage & extraction
│       ├── brief/route.ts        # Brief Agent — pre-meeting brief generation
│       ├── upload/route.ts       # CSV ingestion
│       └── data/route.ts         # Creator dataset
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx           # Fixed left nav — links to all modules
│   └── ui/
│       └── PageHeader.tsx        # Reusable page header with badge/subtitle
├── public/
│   └── mock_campaigns.csv        # Sample creator dataset (fallback)
├── tailwind.config.ts            # Custom dark theme + color tokens
├── package.json
└── .env.local                    # API keys (not committed)
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com/)

### Installation

```bash
git clone https://github.com/Deepthir13/Cloutwatch.git
cd Cloutwatch
npm install
```

### Environment Variables

Create a `.env.local` file at the root:

```env
ANTHROPIC_API_KEY=your-real-key
```

The AI routes read `process.env.ANTHROPIC_API_KEY`.

### Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## URL Structure

| Route | Purpose |
|---|---|
| `/` | Home dashboard / Command Center |
| `/upload` | CSV upload, validation, and preview |
| `/roi-analyzer` | Creator ROI metrics, charts, and AI recommendations |
| `/meeting-notes` | Raw meeting notes extraction and saved notes log |
| `/pre-meeting-brief` | Creator deltas and AI meeting brief generation |
| `/api/data` | Current creator dataset |
| `/api/upload` | Upload or clear custom creator data |
| `/api/analyze` | ROI recommendation generation |
| `/api/meetings` | Meeting note storage and extraction |
| `/api/brief` | Pre-meeting brief generation |

---

## Design System

The UI uses a deliberate dark terminal aesthetic:

| Token | Color | Usage |
|---|---|---|
| `bg-base` | `#0a0a0a` | Page background |
| `bg-surface` | `#111111` | Sidebar background |
| `bg-card` | `#161616` | Module cards |
| `green-primary` | `#1aff66` | Active states, brand accent |
| `red-flag` | `#ff4444` | Risk indicators |
| `amber-warn` | `#ffaa00` | Warning signals |

---

## Adding Real Data

Use `/upload` to upload a CSV with the required columns, or replace `public/mock_campaigns.csv` with a real dataset using the same column format. The app uses uploaded data first, then falls back to the mock CSV.
