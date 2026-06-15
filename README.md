# Cloutwatch

Cloutwatch is a Next.js 14 app-router dashboard for creator investment analysis, CSV uploads, meeting note extraction, and pre-meeting briefs.

## Install

```bash
npm install
```

## Set The API Key

Edit `.env.local` and replace the template value:

```bash
ANTHROPIC_API_KEY=your-real-key
```

The AI routes read `process.env.ANTHROPIC_API_KEY`.

## Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## URL Structure

- `/` - Home dashboard
- `/upload` - CSV upload, validation, and preview
- `/roi-analyzer` - Creator ROI metrics, charts, and AI recommendations
- `/meeting-notes` - Raw meeting notes extraction and saved notes log
- `/pre-meeting-brief` - Creator deltas and AI meeting brief generation
- `/api/data` - Current creator dataset
- `/api/upload` - Upload or clear custom creator data
- `/api/analyze` - ROI recommendation generation
- `/api/meetings` - Meeting note storage and extraction
- `/api/brief` - Pre-meeting brief generation

## Add Real Data

Use `/upload` to upload a CSV with the required columns, or replace `public/mock_campaigns.csv` with a real dataset using the same column format. The app uses uploaded data first, then falls back to the mock CSV.

Uploaded creator data and meeting notes are stored in memory for the active server process.
