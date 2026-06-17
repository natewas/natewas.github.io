# Envelope Tool

A variable-data web app: upload a CSV of mailing addresses and get back a
print-ready PDF with one envelope per row. A live preview shows exactly what the
final PDF will look like, because the preview and the PDF are rendered by the
**same backend code**.

- **Live site:** https://natewasden.com/envelope_tool/
- **Backend API:** https://natewas-github-io-1.onrender.com (FastAPI on Render)

---

## How the pieces fit together

This app has two halves that live in **two different folders** inside the
`natewas.github.io` repo. The folder names differ by one character — easy to mix
up, so read this carefully:

| Piece | Folder | What it is |
|-------|--------|-----------|
| **Frontend source** (you edit this) | `envelope-tool/`  *(hyphen)* | The Angular project. This is the source of truth for the UI. |
| **Frontend deployed output** (served to users) | `envelope_tool/` *(underscore)* | The built files Apache serves. **Do not edit by hand** — it's generated. |
| **Backend** | `envelope_tool/backend/` *(underscore)* | The FastAPI app (`app.py`) deployed to Render. |

> Rule of thumb: **edit only in `envelope-tool/` (hyphen) for the UI, and in
> `envelope_tool/backend/` for the API.** The underscore folder's frontend files
> are build output.

---

## Tech stack

- **Frontend:** Angular 21 (standalone components, signals), server-side
  rendering / prerendering enabled. Served as static files by Apache.
- **Backend:** FastAPI + ReportLab (PDF generation) + pdf2image/poppler
  (PDF→PNG for the preview). Hosted on Render.

---

## Running locally

You need the frontend and backend running at the same time. The frontend
automatically points at the **local** backend when opened on `localhost`.

### Backend (run this first)

```bash
cd envelope_tool/backend
python -m venv venv            # first time only
venv\Scripts\activate          # Windows  (use: source venv/bin/activate on Mac/Linux)
pip install -r requirements.txt
uvicorn app:app --reload --port 5001
```

The frontend expects the local backend on **port 5001** (see `API_BASE_URL` in
`app.component.ts`). You also need **poppler** installed locally and, on Windows,
the `POPPLER_PATH` environment variable pointing at poppler's `bin` folder.

### Frontend

```bash
cd envelope-tool
npm install                    # first time only
npm start                      # serves at http://localhost:4200/
```

Open http://localhost:4200/. On localhost it talks to `http://127.0.0.1:5001`;
on the live site it talks to the Render backend automatically.

---

## Building & deploying

### Frontend → Apache

```bash
cd envelope-tool
npm run build
```

Then copy the built output into the Apache folder, replacing the old files:

- Copy everything from `envelope-tool/dist/envelope-tool/browser/`
- Into `C:\Apache24\htdocs\Portfolio\envelope_tool\`
- Delete the previous `main-*.js` / `polyfills-*.js` so only the new ones remain.

> **Always use `npm run build`, not `ng build` directly.** The `prebuild` step
> generates `src/version.ts` (the build stamp shown in the page footer). A bare
> `ng build` skips it, and since `version.ts` is gitignored, the build would fail
> on a fresh checkout.

### Backend → Render

Render auto-deploys the backend when you **push to `main`**:

```bash
git push origin main
```

Render reinstalls from `requirements.txt` and restarts the server. Confirm the
deploy by visiting https://natewas-github-io-1.onrender.com/version — it reports
the live commit and when the server last started. (Render's free tier sleeps, so
the first request after idle can take a few seconds.)

> Render needs **poppler** available in its environment (for `pdf2image`). Leave
> `POPPLER_PATH` unset on Render — it falls back to the system PATH, which is
> correct on Linux. The exact build/start commands and the service's root
> directory are configured in the Render dashboard.

---

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Health check. |
| GET | `/version` | Deployed commit + server boot time (deploy confirmation). |
| POST | `/preview` | Render a single sample envelope and return it as a PNG. |
| POST | `/upload` | Take the CSV + settings, return a multi-page PDF (one envelope per row). |

The CSV must have these columns: `Recipient Name`, `Street Address`, `City`,
`State`, `ZIP`. A template is downloadable from the app (Step 2).

---

## Confirming what's deployed

The page footer shows: `frontend <git-sha> · built <date> · backend <git-sha> · booted <date>`.

- **frontend** sha/date come from `src/version.ts`, generated at build time.
- **backend** sha/date are fetched live from `/version`.

If both shas match what you pushed, both halves are up to date.

---

## Housekeeping

See `CLEANUP_PLAN.md` for a phased plan to reduce this project's technical debt
(consolidating folders, trimming CSS, gitignore hygiene, tests, etc.). It's
written to be done one safe phase at a time.
