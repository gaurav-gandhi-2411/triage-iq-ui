# triage-iq-ui

React frontend for [TriageIQ](https://github.com/gaurav-gandhi-2411/triage-iq) — ML-powered GitHub issue triage assistant.

**Live API:** `https://triageiq-api-779563952988.us-central1.run.app`

---

## Local development

### Prerequisites

- Node.js 18+
- TriageIQ API running locally (optional — `.env.development` points to `localhost:8080` by default)

### Setup

```bash
git clone https://github.com/gaurav-gandhi-2411/triage-iq-ui.git
cd triage-iq-ui
npm install
npm run dev
# → http://localhost:5173
```

### Environment variables

| File | Committed | Used when | `VITE_API_BASE_URL` |
|---|---|---|---|
| `.env.development` | yes | `npm run dev` | `http://localhost:8080` |
| `.env.development.local` | **no** (gitignored) | `npm run dev` (overrides above) | Cloud Run URL or any override |
| `.env.production` | yes | `npm run build` | Cloud Run URL |

Vite loads `.local` files after the base file and they take precedence. To point your local dev server at the live API without touching committed files:

```powershell
# Run once — creates .env.development.local (gitignored, never committed)
[System.IO.File]::WriteAllText(
  "$PWD\.env.development.local",
  "VITE_API_BASE_URL=https://triageiq-api-779563952988.us-central1.run.app`n",
  [System.Text.UTF8Encoding]::new($false)
)
```

Delete `.env.development.local` to go back to the local API.

> **Windows gotcha — do not edit `.env` files in Notepad.** Notepad saves UTF-8 files with a BOM (`EF BB BF`), which makes Vite parse the env var key as `﻿VITE_API_BASE_URL` instead of `VITE_API_BASE_URL`, causing `undefined` at runtime (symptom: requests go to `localhost:5173/undefined/triage`). Use VS Code, or use the PowerShell `.NET` snippet above.

### Available scripts

```bash
npm run dev      # start dev server (http://localhost:5173)
npm run build    # production build to dist/
npm run preview  # preview production build locally
npm run lint     # ESLint
```

---

## Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (card, input, textarea, select, badge, button, label) |
| Icons | lucide-react |
