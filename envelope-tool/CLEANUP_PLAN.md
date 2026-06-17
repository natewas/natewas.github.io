# Envelope Tool — Cleanup Plan

A practical, low-risk plan to make this project easier to maintain and safer to
change after time away. Written for a non-professional coder: each step explains
*why*, *how risky*, and *how to check it worked*. You do **not** have to do it
all, or all at once. Do them in order — the early ones are the safest and most
valuable.

---

## Guiding principles (read first)

1. **Make a safety net before changing anything.** Commit (and ideally tag) the
   current working version so you can always get back to "it worked."
2. **One change at a time, one commit at a time.** Small commits with clear
   messages mean that if something breaks, you know exactly what did it.
3. **Verify after every step.** Load the site, generate a preview, generate a
   PDF. If all three still work, move on.
4. **Stop when you've had enough.** Every phase leaves the project in a working,
   better state than before. There's no "half-broken" middle.

---

## The current layout (the root of most confusion)

Right now there are effectively **three** things in two folders:

| What | Where it lives today | Problem |
|------|----------------------|---------|
| Angular **source** (you edit this) | `Portfolio\envelope-tool\` (hyphen) | The real project |
| Angular **built output** (served by Apache) | `Portfolio\envelope_tool\` (underscore) | Also contains a **stale duplicate copy** of `src/` |
| **Backend** (FastAPI `app.py`) | `Portfolio\envelope_tool\backend\` (underscore) | Lives in the *output* folder, not the source project |

The single biggest source of risk this whole session was that the **underscore
folder had its own copy of `src/`** that drifted away from the real project.
Fixing that (Phase 3) is the highest-value cleanup.

> Naming note: `envelope-tool` (hyphen) = source. `envelope_tool` (underscore) =
> what the web server shows. Easy to mix up — that's part of the problem.

---

## Phase 0 — Safety net (do this first, ~10 min, no risk)

**Why:** So every later step is reversible.

**How:**
- Commit everything currently working: `git add -A && git commit -m "Working state before cleanup"`
- Tag it so it's easy to find later: `git tag pre-cleanup`
- Confirm what git is actually tracking: `git ls-files | less` (look for junk like
  `venv/`, `node_modules/`, build output — you'll fix those in Phase 2).

**Verify:** `git status` shows a clean tree.

---

## Phase 1 — Write a README (~30 min, no risk, huge payoff)

**Why:** This is the #1 thing that helps "future you after 6 months." A short
doc that says how to run, build, and deploy means you never have to reverse-
engineer your own project again.

**How:** Create `README.md` in `envelope-tool` covering:
- What the app does (CSV in → envelope PDFs out).
- The two-folder layout (copy the table above).
- How to run locally (frontend `npm start`; backend `uvicorn app:app --reload --port 5001`).
- How to build & deploy (`npm run build`, then copy `dist/envelope-tool/browser/*`
  to the Apache folder; `git push` to deploy the backend on Render).
- Where the backend is hosted (Render) and that it needs **poppler** installed.

**Verify:** Hand it to yourself — could you redeploy from scratch using only the README?

---

## Phase 2 — .gitignore hygiene (~20 min, low risk)

**Why:** Build outputs and installed dependencies should never be in git. They
bloat the repo and cause cross-machine breakage (this is exactly what blocked
building your project in a Linux environment — Windows binaries were committed).

**How:**
- In the **backend** repo, ignore the virtual environment: add `backend/venv/`
  to `.gitignore`, then stop tracking it: `git rm -r --cached backend/venv`.
- In the **Angular** project, you already ignore `/dist` and `/node_modules`.
  Also ignore the stray top-level `browser/` folder and `3rdpartylicenses.txt`
  if they're tracked (`git rm -r --cached browser 3rdpartylicenses.txt`).
- Remove the old hashed bundles from the deploy folder when you redeploy (keep
  only the current `main-*.js`).

**Verify:** `git status` after a build shows no `venv/`, `node_modules/`, `dist/`,
or `browser/` changes.

---

## Phase 3 — One source of truth for the frontend (~1 hr, medium risk) ⭐

**Why:** This eliminates the drift that caused the most trouble. The deploy
folder should hold **only** built output + the backend — never editable source.

**How (recommended):**
- Delete the duplicate source in the deploy folder: `envelope_tool\src\`,
  `envelope_tool\scripts\`, `envelope_tool\css\`, and `envelope_tool\_archives\`.
  These are all stale copies or legacy leftovers (e.g. the old vanilla-JS
  `scripts/envelope_tool.js`).
- From now on, the **only** place you edit frontend code is `envelope-tool\src\`.
- Treat `envelope_tool\` (underscore) as a drop zone for build output + `backend\`.

**Verify:** Delete the copies, rebuild from the real project, redeploy, and
confirm the live site still works. (Do this right after Phase 0 so you can revert
if needed.)

---

## Phase 4 — Trim the component CSS (~1 hr, low risk, big readability win)

**Why:** `src/app/app.component.css` is **1,042 lines** — almost all of it is
your whole portfolio's styles (navbar, breadcrumbs, timeline, fun-facts, project
cards…) that this tool never uses. There are also duplicate `body`,
`.main-container`, and `.project-container` blocks (the duplicates are why the
layout regression was hard to spot), and a literal `font-weight: <weight>` typo.

**How:**
- Keep only the rules the envelope tool actually uses: `.hero`, `.main-container`,
  `.project-container`, the form controls, and the `.envelope-preview-*`,
  `.preview-*`, `.app-version`, `.loading-message`, `.inline-checkbox` rules.
- Delete everything for other portfolio pages.
- Remove the now-unused old-preview rules (`.envelope`, `.recipient`,
  `.return-address`) left over from before the server-rendered preview.
- Fix the `font-weight: <weight>` line.

**Verify:** Rebuild, compare the page side-by-side with now. It should look
identical but the file should be a few hundred lines, not 1,000+.

---

## Phase 5 — Backend polish (~1 hr, low risk)

**Why:** Small robustness + clarity improvements.

**How:**
- Replace the `print(...)` debug lines with Python's `logging` module (lets you
  control verbosity and is cleaner in Render logs).
- Pin dependency versions in `requirements.txt` (e.g. `fastapi==x.y.z`) so a
  redeploy can't silently pull a breaking new version. Tip: `pip freeze` shows
  your current versions.
- Add a one-line note in the README that the Render service needs poppler
  installed (for `pdf2image`), and that `POPPLER_PATH` is only for Windows.

**Verify:** Backend still starts (`uvicorn app:app --port 5001`) and `/version`,
`/preview`, `/upload` all respond.

---

## Phase 6 — A one-command deploy script (~45 min, low risk) ⭐

**Why:** Manual "build then copy files" is where mistakes creep in. A tiny script
makes deploys repeatable and removes the drift risk for good.

**How:** A small script (PowerShell `.ps1` or npm script) that:
1. Runs `npm run build`.
2. Clears the old bundles from the Apache folder.
3. Copies `dist/envelope-tool/browser/*` into `Portfolio\envelope_tool\`.

**Verify:** Run it once; confirm the live site updates and only one `main-*.js`
remains.

---

## Phase 7 — A couple of safety-net tests (~1–2 hrs, optional)

**Why:** So you can change `app.py` confidently. Even two tests catch the scary
regressions.

**How:** Add `pytest` tests for the backend that:
- Post a small CSV to `/upload` and assert a multi-page PDF comes back.
- Assert `draw_envelope` centers left-aligned text (the kind of check we did by
  hand this session).

**Verify:** `pytest` passes locally; run it before each backend push.

---

## If you only do three things

1. **Phase 0 + 1** — safety net + README. (An hour; saves you every future return.)
2. **Phase 3** — kill the duplicate frontend source. (Removes the worst risk.)
3. **Phase 6** — the deploy script. (Makes drift impossible going forward.)

---

## Rough effort summary

| Phase | Effort | Risk | Payoff |
|-------|--------|------|--------|
| 0 Safety net | 10 min | none | required |
| 1 README | 30 min | none | very high |
| 2 .gitignore | 20 min | low | high |
| 3 One source of truth | 1 hr | medium | very high |
| 4 Trim CSS | 1 hr | low | high |
| 5 Backend polish | 1 hr | low | medium |
| 6 Deploy script | 45 min | low | very high |
| 7 Tests | 1–2 hr | low | medium |

Nothing here is urgent — the app works today. This is about making the next edit
boring instead of nerve-wracking.
