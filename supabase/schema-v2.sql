-- ============================================================
-- VELITE COMPLIANCE STUDIO v2 — Full Schema Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Safe to run on an existing database — all changes are additive.
-- Existing checks, profiles, style_rules data is untouched.
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- SECTION 1: NEW TABLES
-- ──────────────────────────────────────────────────────────────

-- 1A. PROJECTS
-- One project per product/SKU. Holds the master product record.
-- Checks and versions hang off of projects.

CREATE TABLE IF NOT EXISTS public.projects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name     text NOT NULL,
  category         text,                              -- e.g. "Moisturiser", "Anti-acne"
  track            text NOT NULL DEFAULT 'cosmetic'   -- 'drug' | 'cosmetic'
                   CHECK (track IN ('drug', 'cosmetic')),
  packaging_type   text NOT NULL DEFAULT 'label'      -- 'carton' | 'label' | 'tube' | 'insert' | 'other'
                   CHECK (packaging_type IN ('carton', 'label', 'tube', 'insert', 'other')),
  description      text,
  is_archived      boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.projects IS 'One record per product/SKU. All versions and checks belong to a project.';
COMMENT ON COLUMN public.projects.track IS 'Regulatory track: drug (Drugs & Cosmetics Act) or cosmetic (Cosmetics Rules 2020)';

CREATE INDEX IF NOT EXISTS projects_user_id_idx   ON public.projects (user_id);
CREATE INDEX IF NOT EXISTS projects_track_idx      ON public.projects (track);
CREATE INDEX IF NOT EXISTS projects_archived_idx   ON public.projects (is_archived);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS projects_set_updated_at ON public.projects;
CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 1B. PROJECT VERSIONS
-- Each compliance check run creates a new version under its project.
-- Only one version per project can be is_final = true.

CREATE TABLE IF NOT EXISTS public.project_versions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number   integer NOT NULL,                  -- 1, 2, 3 … auto-incremented per project
  check_id         uuid REFERENCES public.checks(id) ON DELETE SET NULL,
  is_final         boolean NOT NULL DEFAULT false,    -- only one per project can be true
  version_type     text NOT NULL DEFAULT 'pre-print'  -- 'pre-print' | 'post-print'
                   CHECK (version_type IN ('pre-print', 'post-print')),
  notes            text,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version_number)                 -- enforce sequential numbering
);

COMMENT ON TABLE public.project_versions IS 'Each check run under a project is stored as a version (v1, v2 …). Only one version can be marked final.';
COMMENT ON COLUMN public.project_versions.is_final IS 'When true, this version is locked and stored in the asset library.';

CREATE INDEX IF NOT EXISTS project_versions_project_id_idx ON public.project_versions (project_id);
CREATE INDEX IF NOT EXISTS project_versions_check_id_idx   ON public.project_versions (check_id);
CREATE INDEX IF NOT EXISTS project_versions_is_final_idx   ON public.project_versions (is_final);

-- Enforce: only one final version per project
CREATE UNIQUE INDEX IF NOT EXISTS one_final_per_project
  ON public.project_versions (project_id)
  WHERE is_final = true;


-- 1C. ASSETS
-- Per-project asset library: artwork, CDR, 3D renders, inserts, etc.
-- Stored in Supabase Storage bucket: assets/{project_id}/{asset_type}/

CREATE TABLE IF NOT EXISTS public.assets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_id       uuid REFERENCES public.project_versions(id) ON DELETE SET NULL,
  file_name        text NOT NULL,
  file_path        text NOT NULL,                     -- Supabase Storage path
  asset_type       text NOT NULL DEFAULT 'other'
                   CHECK (asset_type IN (
                     'artwork_front', 'artwork_back',
                     'cdr',
                     'render_3d',
                     'label_front', 'label_back',
                     'insert',
                     'compliance_report', 'designer_brief',
                     'annotated_image',
                     'other'
                   )),
  mime_type        text,
  file_size_bytes  bigint,
  is_final         boolean NOT NULL DEFAULT false,
  notes            text,
  uploaded_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assets IS 'Per-project asset library. Supports artwork, CDR, 3D renders, inserts, compliance PDFs.';

CREATE INDEX IF NOT EXISTS assets_project_id_idx   ON public.assets (project_id);
CREATE INDEX IF NOT EXISTS assets_version_id_idx   ON public.assets (version_id);
CREATE INDEX IF NOT EXISTS assets_asset_type_idx   ON public.assets (asset_type);
CREATE INDEX IF NOT EXISTS assets_is_final_idx     ON public.assets (is_final);


-- 1D. EXPORT REGULATIONS
-- Stores per-country regulatory requirements, either AI-fetched or manually uploaded.
-- Used by the Export Compliance Module (Module 4).

CREATE TABLE IF NOT EXISTS public.export_regulations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country              text NOT NULL,                 -- e.g. "European Union", "United States"
  country_code         text,                          -- ISO 3166-1 alpha-2: EU, US, GB, AE, SG, CA, AU
  track                text NOT NULL DEFAULT 'cosmetic'
                       CHECK (track IN ('drug', 'cosmetic', 'both')),
  regulation_name      text NOT NULL,
  source_url           text,
  content_summary      text,                          -- AI-generated summary of requirements
  full_content         text,                          -- Full extracted text (if available)
  manual_upload_path   text,                          -- Supabase Storage path if user uploaded a PDF
  is_active            boolean NOT NULL DEFAULT true,
  last_updated         timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.export_regulations IS 'Per-country labelling regulations for the Export Compliance module. Populated by AI fetch or manual PDF upload.';

CREATE INDEX IF NOT EXISTS export_regs_country_code_idx ON public.export_regulations (country_code);
CREATE INDEX IF NOT EXISTS export_regs_track_idx        ON public.export_regulations (track);

-- Seed with the known target markets (empty content — to be filled by AI fetch or manual upload)
INSERT INTO public.export_regulations (country, country_code, track, regulation_name, is_active)
VALUES
  ('European Union',           'EU', 'cosmetic', 'EU Cosmetics Regulation 1223/2009',                    true),
  ('European Union',           'EU', 'drug',     'EU Directive 2001/83/EC (Medicinal Products)',         true),
  ('United States',            'US', 'cosmetic', 'FDA MoCRA (Modernisation of Cosmetics Regulation Act)',true),
  ('United States',            'US', 'drug',     'FDA OTC Drug Labeling Requirements 21 CFR Part 201',   true),
  ('United Kingdom',           'GB', 'cosmetic', 'UK Cosmetics Regulation (Retained EU Law)',             true),
  ('UAE / GCC',                'AE', 'cosmetic', 'GCC Technical Regulation for Cosmetics',               true),
  ('Singapore',                'SG', 'cosmetic', 'HSA Cosmetic Products Regulation',                     true),
  ('Malaysia',                 'MY', 'cosmetic', 'NPRA Cosmetic Notification Scheme',                    true),
  ('Canada',                   'CA', 'cosmetic', 'Canada Consumer Product Safety Act — Cosmetics Regs',  true),
  ('Australia',                'AU', 'cosmetic', 'NICNAS / AICIS Cosmetics Registration',                true)
ON CONFLICT DO NOTHING;


-- 1E. INTERNAL GUIDELINES
-- User-uploaded PDFs / images containing Velite's internal packaging SOPs and brand standards.
-- Active guidelines are injected into every AI compliance check.

CREATE TABLE IF NOT EXISTS public.internal_guidelines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name        text NOT NULL,
  file_path        text NOT NULL,                     -- Supabase Storage: guidelines/{id}/{file_name}
  title            text,                              -- Display name / short title
  summary          text,                              -- AI-extracted summary (used in prompts)
  full_content     text,                              -- Full extracted text from the PDF/image
  category         text DEFAULT 'general',            -- 'general' | 'brand' | 'regulatory' | 'sop'
  is_active        boolean NOT NULL DEFAULT true,
  applies_to_track text DEFAULT 'both'               -- 'drug' | 'cosmetic' | 'both'
                   CHECK (applies_to_track IN ('drug', 'cosmetic', 'both')),
  uploaded_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.internal_guidelines IS 'User-uploaded Velite internal SOPs, brand standards, and packaging guidelines. Active ones are injected into every AI compliance check.';

CREATE INDEX IF NOT EXISTS internal_guidelines_is_active_idx      ON public.internal_guidelines (is_active);
CREATE INDEX IF NOT EXISTS internal_guidelines_applies_to_idx     ON public.internal_guidelines (applies_to_track);


-- 1F. PRODUCT MEMORY
-- Running correction history per project. On each new version check,
-- Claude is shown past issues and verifies they have been resolved.

CREATE TABLE IF NOT EXISTS public.product_memory (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  issue_title         text NOT NULL,
  regulation          text,
  field               text,                           -- Which label field the issue was on
  original_finding    text,                           -- What Claude found initially
  correction_applied  text,                           -- What correction was made
  version_raised      integer,                        -- Version where issue was first found
  version_resolved    integer,                        -- Version where it was confirmed fixed (null = unresolved)
  is_resolved         boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.product_memory IS 'Persistent correction history per project. Claude uses this to verify previous issues are fixed on each new version check.';

CREATE INDEX IF NOT EXISTS product_memory_project_id_idx   ON public.product_memory (project_id);
CREATE INDEX IF NOT EXISTS product_memory_is_resolved_idx  ON public.product_memory (is_resolved);

DROP TRIGGER IF EXISTS product_memory_set_updated_at ON public.product_memory;
CREATE TRIGGER product_memory_set_updated_at
  BEFORE UPDATE ON public.product_memory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ──────────────────────────────────────────────────────────────
-- SECTION 2: MODIFY EXISTING TABLES
-- ──────────────────────────────────────────────────────────────

-- 2A. Extend the `checks` table with new columns.
-- All new columns are nullable / have defaults — existing rows are not broken.

ALTER TABLE public.checks
  ADD COLUMN IF NOT EXISTS project_id        uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version_number    integer,
  ADD COLUMN IF NOT EXISTS track             text DEFAULT 'cosmetic'
                                             CHECK (track IN ('drug', 'cosmetic')),
  ADD COLUMN IF NOT EXISTS check_type        text DEFAULT 'pre-print'
                                             CHECK (check_type IN ('pre-print', 'post-print')),
  -- Dual file upload: front + back (label_file_path kept for backward compat)
  ADD COLUMN IF NOT EXISTS front_file_path   text,
  ADD COLUMN IF NOT EXISTS back_file_path    text,
  ADD COLUMN IF NOT EXISTS back_file_name    text,
  -- Annotation: path to the annotated image stored in Storage
  ADD COLUMN IF NOT EXISTS annotated_image_path text,
  -- JSON array of {x, y, issue_index} for annotation markers
  ADD COLUMN IF NOT EXISTS annotation_markers   jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.checks.project_id      IS 'FK to projects. NULL for standalone checks (backward compat).';
COMMENT ON COLUMN public.checks.track           IS 'Regulatory track used for this check: drug or cosmetic.';
COMMENT ON COLUMN public.checks.check_type      IS 'Pre-print draft check or post-print final verification.';
COMMENT ON COLUMN public.checks.front_file_path IS 'Storage path for front face of label/carton. New dual-upload field.';
COMMENT ON COLUMN public.checks.back_file_path  IS 'Storage path for back face of label/carton.';
COMMENT ON COLUMN public.checks.annotation_markers IS 'JSON array [{x, y, issue_index, label}] for canvas overlay.';

CREATE INDEX IF NOT EXISTS checks_project_id_idx ON public.checks (project_id);
CREATE INDEX IF NOT EXISTS checks_track_idx      ON public.checks (track);


-- 2B. Extend `style_rules` to link back to the project that generated it.
ALTER TABLE public.style_rules
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;


-- ──────────────────────────────────────────────────────────────
-- SECTION 3: STORAGE BUCKETS
-- ──────────────────────────────────────────────────────────────
-- Run these in Supabase Dashboard → Storage → New Bucket
-- (SQL API for bucket creation is not available via SQL editor,
--  but included here as documentation)

-- Bucket: "assets"       — project artwork, CDR, 3D renders, inserts
-- Bucket: "guidelines"   — internal Velite guideline PDFs/images
-- Bucket: "labels"       — already exists (compliance check label uploads)
-- Bucket: "reports"      — generated compliance PDFs and annotated images

-- Recommended bucket settings for "assets" and "reports":
--   Public: false (signed URLs only)
--   File size limit: 50MB
--   Allowed MIME types: image/*, application/pdf, application/octet-stream (CDR)


-- ──────────────────────────────────────────────────────────────
-- SECTION 4: ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────
-- Mirror the same pattern as the existing tables.
-- Users see only their own data.

ALTER TABLE public.projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_versions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_guidelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_memory      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_regulations  ENABLE ROW LEVEL SECURITY;

-- Projects: owner-only
DROP POLICY IF EXISTS "projects_owner" ON public.projects;
CREATE POLICY "projects_owner" ON public.projects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Project versions: accessible if the parent project belongs to the user
DROP POLICY IF EXISTS "project_versions_owner" ON public.project_versions;
CREATE POLICY "project_versions_owner" ON public.project_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_versions.project_id AND p.user_id = auth.uid()
    )
  );

-- Assets: accessible if the parent project belongs to the user
DROP POLICY IF EXISTS "assets_owner" ON public.assets;
CREATE POLICY "assets_owner" ON public.assets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = assets.project_id AND p.user_id = auth.uid()
    )
  );

-- Internal guidelines: all authenticated users can read active ones; owners manage
DROP POLICY IF EXISTS "internal_guidelines_read" ON public.internal_guidelines;
CREATE POLICY "internal_guidelines_read" ON public.internal_guidelines
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "internal_guidelines_write" ON public.internal_guidelines;
CREATE POLICY "internal_guidelines_write" ON public.internal_guidelines
  FOR ALL USING (auth.uid() = uploaded_by) WITH CHECK (auth.uid() = uploaded_by);

-- Product memory: owner via project
DROP POLICY IF EXISTS "product_memory_owner" ON public.product_memory;
CREATE POLICY "product_memory_owner" ON public.product_memory
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = product_memory.project_id AND p.user_id = auth.uid()
    )
  );

-- Export regulations: all authenticated users can read; only owners can write
DROP POLICY IF EXISTS "export_regulations_read" ON public.export_regulations;
CREATE POLICY "export_regulations_read" ON public.export_regulations
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "export_regulations_write" ON public.export_regulations;
CREATE POLICY "export_regulations_write" ON public.export_regulations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "export_regulations_update" ON public.export_regulations;
CREATE POLICY "export_regulations_update" ON public.export_regulations
  FOR UPDATE USING (auth.role() = 'authenticated');


-- ──────────────────────────────────────────────────────────────
-- SECTION 5: HELPER VIEWS
-- ──────────────────────────────────────────────────────────────

-- View: latest version per project (useful for Projects list page)
CREATE OR REPLACE VIEW public.project_latest AS
SELECT
  p.id                          AS project_id,
  p.product_name,
  p.category,
  p.track,
  p.packaging_type,
  p.is_archived,
  p.created_at                  AS project_created_at,
  p.updated_at,
  pv.id                         AS latest_version_id,
  pv.version_number             AS latest_version,
  pv.version_type,
  pv.is_final,
  c.verdict,
  c.score,
  c.created_at                  AS last_check_at,
  c.track                       AS last_check_track
FROM public.projects p
LEFT JOIN public.project_versions pv
  ON pv.project_id = p.id
  AND pv.version_number = (
    SELECT MAX(v2.version_number)
    FROM public.project_versions v2
    WHERE v2.project_id = p.id
  )
LEFT JOIN public.checks c ON c.id = pv.check_id;

COMMENT ON VIEW public.project_latest IS 'One row per project showing the latest version and its compliance check result.';


-- View: unresolved product memory issues (used by AI prompt builder)
CREATE OR REPLACE VIEW public.open_product_issues AS
SELECT
  pm.*,
  p.product_name,
  p.track
FROM public.product_memory pm
JOIN public.projects p ON p.id = pm.project_id
WHERE pm.is_resolved = false;


-- ──────────────────────────────────────────────────────────────
-- SECTION 6: VERIFY (run these SELECTs to confirm all tables exist)
-- ──────────────────────────────────────────────────────────────
/*
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should show: assets, checks, export_regulations, internal_guidelines,
--              product_memory, profiles, project_versions, projects, style_rules
*/

-- ── END OF MIGRATION ──
