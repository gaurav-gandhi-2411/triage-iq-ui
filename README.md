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

| File | Used when | `VITE_API_BASE_URL` |
|---|---|---|
| `.env.development` | `npm run dev` | `http://localhost:8080` |
| `.env.production` | `npm run build` | Cloud Run URL |

> **Windows gotcha — do not edit `.env` files in Notepad.** Notepad saves UTF-8 files with a BOM (`EF BB BF`), which makes Vite read the env var key as `﻿VITE_API_BASE_URL` instead of `VITE_API_BASE_URL`, causing `undefined` at runtime (symptom: requests go to `localhost:5173/undefined/triage`). Use VS Code, or write the file from PowerShell with .NET's `WriteAllText` + `UTF8Encoding(emitBOM: false)`:
>
> ```powershell
> [System.IO.File]::WriteAllText(
>   "$PWD\.env.development",
>   "VITE_API_BASE_URL=http://localhost:8080`n",
>   [System.Text.UTF8Encoding]::new($false)
> )
> ```

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
