# Velite Compliance Studio v2 — Claude Code Context

> This file is read automatically by Claude Code at session start.
> Last updated: 2026-05-06

---

## Project Identity
- **App**: Velite Compliance Studio v2
- **Purpose**: Cosmetic & Drug packaging compliance checker for Velite Healthcare
- **Live URL**: https://velite-compliance-studio.vercel.app
- **GitHub**: (connect remote and update this line after first push)
- **Local path**: `D:\ALL DOWNLOAD\Operations App\velite-compliance-studio\`
- **Stack**: React 18 + Vite, Supabase (auth/db/storage), Anthropic Claude API
- **Deploy**: Vercel auto-deploys from GitHub `main` branch

---

## Environment Variables (`.env` — never commit, never put keys here)
Create a `.env` file in the project root with these keys.
Values are stored in Vercel environment variables and in your password manager.
```
VITE_SUPABASE_URL=https://ynoxxwkcuchvstsfxtqw.supabase.co
VITE_SUPABASE_ANON_KEY=<get from Supabase dashboard → Settings → API>
VITE_ANTHROPIC_API_KEY=<get from Anthropic console → API Keys>
```

---

## Design System
- **Primary colour**: `#1D6B4A` (Velite green)
- **Sidebar bg**: `#0e2b1f` (deep green)
- **Drug track**: amber `#b45309`
- **Cosmetic track**: green `#1D6B4A`
- **Font**: Inter
- **CSS vars**: all in `src/index.css` `:root` block

---

## Database — Supabase Project `ynoxxwkcuchvstsfxtqw`

### Tables (existing before v2)
| Table | Notes |
|---|---|
| `profiles` | id, full_name |
| `checks` | Core compliance check record — extended with new columns in v2 |
| `style_rules` | Auto-learned + manual style rules |

### Tables (added in schema-v2.sql — already run ✅)
| Table | Purpose |
|---|---|
| `projects` | One per product/SKU. Has `track` (drug/cosmetic), `packaging_type` |
| `project_versions` | Each check = one version (v1, v2…). One final per project enforced by unique index |
| `assets` | Per-project file library (artwork, CDR, 3D, inserts) |
| `export_regulations` | Country-specific labelling rules. Pre-seeded with 10 markets |
| `internal_guidelines` | Velite SOP/brand PDFs injected into every AI check |
| `product_memory` | Running correction history per project for Claude context |

### `checks` table — new columns added
`project_id`, `version_number`, `track`, `check_type` (pre/post-print),
`front_file_path`, `back_file_path`, `back_file_name`,
`annotated_image_path`, `annotation_markers` (jsonb)

### Views (created in schema-v2.sql)
- `project_latest` — one row per project with latest version + verdict
- `open_product_issues` — unresolved product_memory rows

### Storage buckets needed (create manually in Supabase dashboard)
- `labels` ✅ already exists
- `assets` ⬜ create (private, 50MB)
- `guidelines` ⬜ create (private, 50MB)
- `reports` ⬜ create (private, 50MB)

---

## Build & Deploy Rules
```bash
npm run dev        # local dev server → http://localhost:5173
npm run build      # MUST run after every change — fix all errors before commit
git add -A && git commit -m "..." && git push origin main   # triggers Vercel deploy
```
**Rule**: Never push if `npm run build` has errors.

---

## Module Build Status

### ✅ COMPLETED

#### Schema Migration (Step 1)
- File: `supabase/schema-v2.sql` — run in Supabase SQL editor ✅

#### Module 1 — Projects Structure
- CSS updated to green `#1D6B4A` design system (`src/index.css`)
- `src/components/TrackBadge.jsx` — Drug (amber) / Cosmetic (green) badge
- `src/pages/Projects.jsx` — grid of project cards, track filter, search
- `src/pages/NewProject.jsx` — create project: name, category, track selector, packaging type
- `src/pages/ProjectDetail.jsx` — 4 tabs: Version History, Compare Versions, Issue Memory, Assets
  - Version history: version rows with score circle, verdict, mark-final button
  - Compare: side-by-side diff of two versions' report_json items
  - Memory: table of product_memory rows (open/resolved issues)
  - Assets: placeholder for Module 5

### ⏸ STOPPED MID-MODULE 1 — needs completion before building
- `src/App.jsx` — routes for `/projects`, `/projects/new`, `/projects/:id` NOT YET ADDED
- `src/components/Layout.jsx` — sidebar nav items NOT YET UPDATED
- `npm run build` — NOT YET RUN for Module 1
- GitHub push — NOT YET DONE

### ⬜ PENDING MODULES
| Module | Description |
|---|---|
| 2 | Dual Regulatory Track — Drug vs Cosmetic toggle on every check |
| 3A | Dual file upload (front + back of carton/label) |
| 3B | Text Generator — Claude generates full label text from product details |
| 3C | Annotation Layer — numbered markers on label image canvas |
| 3D | Logo/Mark Check (ISI, green dot, recycling, Ayush, certifications) |
| 3E | Pre-print vs Post-print tagging |
| 4  | Export Compliance Module — gap report for EU/US/UAE/etc |
| 5  | Asset Library — upload artwork, CDR, 3D, inserts per project |
| 6  | Reports — annotated JPEG, compliance PDF, designer brief PDF |
| 7A | Internal Guidelines upload + AI extraction |
| 7B | Auto-learning from approved labels (already partially exists) |
| 7C | Product Memory — Claude checks previous issues are resolved |

---

## Navigation Structure (target)
```
Sidebar:
  ◈ Dashboard
  📁 Projects          ← NEW (Module 1)
  ＋ New Check
  🌍 Export Module     ← NEW (Module 4)
  📁 Asset Library     ← NEW (Module 5)
  📋 Internal Guidelines ← NEW (Module 7A)
  ◉ Style Guide
  ◷ History
  📋 Regulations
  ⚙ Settings
```

---

## Current File Structure
```
velite-compliance-studio/
├── .env                          ← NOT in git
├── .gitignore
├── CLAUDE.md                     ← this file
├── HANDOFF.md                    ← detailed session notes
├── index.html
├── package.json
├── vite.config.js
├── supabase/
│   └── schema-v2.sql             ← already executed ✅
└── src/
    ├── App.jsx                   ← ⏸ needs routes added
    ├── index.css                 ← ✅ green design system
    ├── main.jsx
    ├── components/
    │   ├── Layout.jsx            ← ⏸ needs sidebar nav updated
    │   ├── ScoreCircle.jsx
    │   ├── TrackBadge.jsx        ← ✅ new
    │   └── VerdictBadge.jsx
    ├── context/
    │   └── AuthContext.jsx
    ├── lib/
    │   ├── anthropic.js          ← needs upgrade in Module 3
    │   ├── regulations.js
    │   └── supabase.js
    └── pages/
        ├── CheckDetail.jsx
        ├── Dashboard.jsx
        ├── History.jsx
        ├── Login.jsx
        ├── NewCheck.jsx          ← needs Module 2 (track toggle) + 3A (dual upload)
        ├── NewProject.jsx        ← ✅ new
        ├── ProjectDetail.jsx     ← ✅ new
        ├── Projects.jsx          ← ✅ new
        ├── Regulations.jsx
        └── StyleGuide.jsx
```

---

## Resuming on a New PC

1. `git clone <repo-url>`
2. `cd velite-compliance-studio && npm install`
3. Create `.env` with the 3 keys above
4. Read this file + `HANDOFF.md` for full context
5. **First task**: complete the ⏸ items above (App.jsx routes, Layout.jsx sidebar, build, push)
6. Then continue with Module 2

---

## Key Design Decisions (don't change these)
- Track toggle (Drug/Cosmetic) is the **most prominent UI element** on every check
- Projects are the primary unit — checks hang off projects as versions
- Only one version per project can be `is_final = true` (enforced by DB unique index)
- Backward compat: existing `checks` rows without `project_id` still work (null FK)
- AI API key is in `.env` only — never in bundle for production (use Vercel env vars)
- All AI operations must show loading state with progress message
- `npm run build` must pass before every commit
