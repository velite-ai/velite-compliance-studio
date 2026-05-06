# Session Handoff — Velite Compliance Studio v2
> Written: 2026-05-06 | Read CLAUDE.md first for full context

---

## What was built this session (in order)

### 1. Original app reverse-engineered from Vercel deployment
- Fetched JS bundle from https://velite-compliance-studio.vercel.app/assets/index-N_y9Hsag.js
- Extracted: Supabase config, Claude API key, all routes, DB tables, AI prompt, product categories
- Original stack confirmed: React + Vite, Supabase, Claude API (claude-opus-4-5)

### 2. Full app rebuilt locally (v1 → v2 foundation)
Built from scratch at `D:\ALL DOWNLOAD\Operations App\velite-compliance-studio\`:
- package.json, vite.config.js, index.html
- src/lib/supabase.js, anthropic.js, regulations.js
- src/context/AuthContext.jsx
- src/components/Layout.jsx, ScoreCircle.jsx, VerdictBadge.jsx
- src/pages/Login.jsx, Dashboard.jsx, NewCheck.jsx, CheckDetail.jsx, History.jsx, StyleGuide.jsx, Regulations.jsx

### 3. Schema migration (schema-v2.sql) — EXECUTED ✅
File at: `supabase/schema-v2.sql`
New tables: projects, project_versions, assets, export_regulations, internal_guidelines, product_memory
Modified: checks (8 new columns), style_rules (project_id column)
Views: project_latest, open_product_issues
RLS policies added to all new tables
Export regulations pre-seeded with 10 markets (EU, US, UK, UAE, SG, MY, CA, AU + drug variants)

### 4. Module 1 — Projects Structure (PARTIAL ⏸)
**Completed:**
- CSS redesigned to Velite green #1D6B4A (all vars updated in index.css)
- Drug track: amber #b45309 | Cosmetic track: green #1D6B4A
- src/components/TrackBadge.jsx — inline badge with Drug/Cosmetic colours
- src/pages/Projects.jsx — project grid with card layout, track filter toggle, search
- src/pages/NewProject.jsx — create project form (name, category, track selector with reg list, packaging type picker)
- src/pages/ProjectDetail.jsx — 4-tab detail page:
  - Versions tab: version rows with ScoreCircle, VerdictBadge, mark-final button
  - Compare tab: dropdown selectors + side-by-side diff panel
  - Memory tab: table of product_memory (open/resolved)
  - Assets tab: placeholder ("Coming in Module 5")

**NOT YET DONE (do these first on resume):**
- [ ] Update src/App.jsx — add routes for /projects, /projects/new, /projects/:id
- [ ] Update src/components/Layout.jsx — add Projects, Export Module, Asset Library, Internal Guidelines, Settings to sidebar
- [ ] Run `npm run build` — fix any errors
- [ ] git init + add remote + push to GitHub main
- [ ] Verify Vercel auto-deploys

---

## Immediate next steps on resume

### Step A — Finish App.jsx (5 min)
Add these imports and routes inside the protected `<Route path="/">`:
```jsx
import Projects      from './pages/Projects'
import NewProject    from './pages/NewProject'
import ProjectDetail from './pages/ProjectDetail'

// Inside <Route path="/" element={<Layout />}>
<Route path="projects"          element={<Projects />} />
<Route path="projects/new"      element={<NewProject />} />
<Route path="projects/:id"      element={<ProjectDetail />} />
```

### Step B — Finish Layout.jsx sidebar
Replace the NAV array with:
```jsx
const NAV = [
  { to: '/',              label: 'Dashboard',          icon: '◈', end: true },
  { to: '/projects',      label: 'Projects',           icon: '📁' },
  { to: '/new-check',     label: 'New Check',          icon: '＋' },
  { to: '/history',       label: 'History',            icon: '◷' },
  { to: '/style-guide',   label: 'Style Guide',        icon: '◉' },
  { to: '/regulations',   label: 'Regulations',        icon: '📋' },
  // Placeholders for future modules:
  { to: '/export',        label: 'Export Module',      icon: '🌍' },
  { to: '/assets',        label: 'Asset Library',      icon: '📁' },
  { to: '/guidelines',    label: 'Internal Guidelines',icon: '📚' },
]
```
Also add PAGE_TITLES entries for the new routes.

### Step C — Build + Push
```bash
cd "D:/ALL DOWNLOAD/Operations App/velite-compliance-studio"
npm run build
git add -A
git commit -m "Module 1: Projects structure, green design system, schema v2"
git push origin main
```

---

## The full 7-module spec (reference)

### MODULE 2 — Dual Regulatory Track
- Prominent Drug/Cosmetic toggle on every compliance check
- Drug: checks Drugs & Cosmetics Act 1940, Rules 1945, Schedule P/FF, drug licence, composition, directions, warnings, batch/mfg/expiry, storage conditions, Schedule H/H1/X
- Cosmetic: checks Cosmetics Rules 2020, Legal Metrology 2011, INCI, claim boundaries
- Both tracks: internal guidelines + style guide + logo/mark check
- Implementation: add `track` prop to analyseLabel(), build separate system prompt branches in anthropic.js

### MODULE 3 — AI Compliance Engine Upgrades
**3A** — Dual file upload: front + back images, both passed to Claude together
**3B** — Text Generator: user inputs product approval details → Claude generates complete label text in correct regulatory format
**3C** — Annotation Layer: canvas overlay with numbered markers on label image at issue locations. Must be downloadable as JPEG/PNG. Use HTML5 Canvas, not a library.
**3D** — Logo/Mark Check: ISI mark, green/brown dot, recycling symbols, Ayush mark, certifications (ISO, derm tested). Flag unsubstantiated claims.
**3E** — Pre-print vs Post-print: tag each check. Post-print compares against approved pre-print version and highlights unauthorised changes.

### MODULE 4 — Export Compliance Module
- Select target country from: EU, USA, UK, UAE/GCC, SE Asia (SG/MY), CA, AU + custom
- Claude uses web search to fetch current country requirements (Anthropic web search tool)
- User can also upload country regulatory PDFs → stored in `export_regulations` table
- Generates GAP REPORT: India label vs export country
- Data stored in `export_regulations` table (already created in schema)

### MODULE 5 — Asset Library
- Per-project tab (already in ProjectDetail.jsx as placeholder)
- Upload types: artwork (JPEG/PNG/PDF), CDR, 3D renders, label front/back, insert, other
- Each asset: type tag, upload date, uploaded by, version number, notes, is_final flag
- CDR stored as-is (no preview)
- Storage: `assets/{project_id}/{asset_type}/`
- Supabase Storage bucket: `assets` (needs manual creation)

### MODULE 6 — Reports and Output
- Annotated JPEG: label image + numbered issue markers (from Module 3C)
- Compliance PDF: full structured report, editable before save, Velite-branded (green header)
- Designer Brief PDF: FAIL + WARNING items only, formatted for sharing with designer
- All PDFs: professional Velite branding (green header, company name, product name, version, date)
- PDF generation: jsPDF + html2canvas (already in package.json)

### MODULE 7 — App Memory and Learning
**7A** — Internal Guidelines: dedicated page, PDF/image upload, AI extracts + summarises content, active guidelines injected into every check prompt
**7B** — Auto-learning: when label marked FINAL, Claude extracts style patterns → saved to style_rules table (partial implementation already exists)
**7C** — Product Memory: correction history stored in product_memory table, fed into AI prompt for each new version check

---

## DB Schema Quick Reference

```sql
-- Key relationships:
-- projects → project_versions → checks
--         → assets
--         → product_memory
-- internal_guidelines (global, not per-project)
-- export_regulations (global, per country)
-- style_rules (global + per-project via project_id)

-- Next version number for a project:
SELECT COALESCE(MAX(version_number), 0) + 1
FROM project_versions WHERE project_id = '<id>';

-- Save a new version after check:
INSERT INTO project_versions (project_id, version_number, check_id, version_type, created_by)
VALUES ('<project_id>', <next_num>, '<check_id>', 'pre-print', '<user_id>');

-- Also update checks.project_id + version_number after insert
```

---

## Supabase Storage Buckets
Create these manually in Supabase Dashboard → Storage → New Bucket:
| Bucket | Public | Size limit | MIME types |
|---|---|---|---|
| `labels` | false | 20MB | image/* |
| `assets` | false | 50MB | image/*, application/pdf, application/octet-stream |
| `guidelines` | false | 50MB | image/*, application/pdf |
| `reports` | false | 20MB | image/*, application/pdf |

---

## Important file paths
| File | Purpose |
|---|---|
| `src/lib/anthropic.js` | AI analysis function — needs drug track + dual upload in Module 2/3A |
| `src/lib/regulations.js` | Product categories, regulation toggles, regulation library, ingredient flags |
| `src/pages/NewCheck.jsx` | Main compliance check flow — needs track toggle (Module 2) |
| `supabase/schema-v2.sql` | Full migration SQL — already executed, keep for reference |
| `CLAUDE.md` | Auto-loaded by Claude Code on session start |

---

## Decisions made (don't revisit)
1. Track toggle is THE most important UI element — always visible, always prominent
2. Projects are the primary structure — all checks belong to a project version
3. Existing standalone checks (no project_id) still work — backward compat maintained
4. API key in .env only — Vercel env vars for production (never in bundle)
5. `npm run build` must pass before every commit — no exceptions
6. CSS uses CSS custom properties throughout — no hardcoded colour values in components
7. Annotation layer uses HTML5 Canvas (not a library)
8. PDF export uses jsPDF + html2canvas (already installed)
