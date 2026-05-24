-- ============================================================
-- VELITE QC MODULE — Phase 1 Schema (Quality Control core)
-- Run this in Supabase SQL Editor AFTER schema-v2.sql.
-- Safe to run on an existing database — all changes are additive.
-- Existing tables (projects, checks, profiles…) are untouched.
-- ============================================================
--
-- Entity mapping (one shared system, filtered by track):
--   track = 'cosmetic'  → Velite Healthcare      (cosmetics)
--   track = 'drug'      → Velite Pharmaceuticals  (drugs)
--
-- Access model (Phase 1): owner-based RLS, mirroring the rest of
-- the app (one shared Velite login sees its own data). True
-- multi-user role separation (Operator / QC / QA) lands in the
-- QA phase — the profiles.role column below is the groundwork.
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- SECTION 1: ROLE GROUNDWORK
-- ──────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin'
    CHECK (role IN ('operator', 'qc_analyst', 'qc_manager', 'qa', 'admin'));

COMMENT ON COLUMN public.profiles.role IS 'Department role. Used for segregation of duties from the QA phase onward.';


-- ──────────────────────────────────────────────────────────────
-- SECTION 2: QC SPECIFICATIONS
-- A reusable spec for a material or product. Parameters are stored
-- as JSONB so a small team can adapt the test list without a
-- developer or a migration.
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.qc_specifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id    uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  name          text NOT NULL,
  track         text NOT NULL DEFAULT 'cosmetic'
                CHECK (track IN ('drug', 'cosmetic')),
  material_type text NOT NULL DEFAULT 'finished_good'
                CHECK (material_type IN ('raw_material', 'packaging', 'in_process', 'finished_good')),
  description   text,
  -- [{ name, method, type:'numeric'|'text'|'boolean', min, max, unit, expected, severity:'critical'|'major'|'minor' }]
  parameters    jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.qc_specifications IS 'Reusable QC specification (parameter list) for a material or finished product.';

CREATE INDEX IF NOT EXISTS qc_specs_user_idx     ON public.qc_specifications (user_id);
CREATE INDEX IF NOT EXISTS qc_specs_track_idx     ON public.qc_specifications (track);
CREATE INDEX IF NOT EXISTS qc_specs_material_idx  ON public.qc_specifications (material_type);
CREATE INDEX IF NOT EXISTS qc_specs_project_idx   ON public.qc_specifications (project_id);

DROP TRIGGER IF EXISTS qc_specs_set_updated_at ON public.qc_specifications;
CREATE TRIGGER qc_specs_set_updated_at
  BEFORE UPDATE ON public.qc_specifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ──────────────────────────────────────────────────────────────
-- SECTION 3: QC BATCHES / LOTS
-- One row per batch or lot under test. Status drives the QC flow.
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.qc_batches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id        uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  spec_id           uuid REFERENCES public.qc_specifications(id) ON DELETE SET NULL,
  batch_no          text NOT NULL,
  product_name      text NOT NULL,
  track             text NOT NULL DEFAULT 'cosmetic'
                    CHECK (track IN ('drug', 'cosmetic')),
  material_type     text NOT NULL DEFAULT 'finished_good'
                    CHECK (material_type IN ('raw_material', 'packaging', 'in_process', 'finished_good')),
  supplier          text,                         -- raw / packaging material vendor
  mfg_date          date,
  expiry_date       date,
  quantity          numeric,
  uom               text,                         -- units of measure (kg, L, pcs…)
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'in_test', 'released', 'rejected', 'quarantine', 'on_hold')),
  disposition_notes text,
  disposition_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  disposition_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.qc_batches IS 'A production / received batch or lot moving through the QC flow.';
COMMENT ON COLUMN public.qc_batches.status IS 'draft → in_test → released | rejected | quarantine | on_hold';

CREATE INDEX IF NOT EXISTS qc_batches_user_idx     ON public.qc_batches (user_id);
CREATE INDEX IF NOT EXISTS qc_batches_track_idx     ON public.qc_batches (track);
CREATE INDEX IF NOT EXISTS qc_batches_status_idx     ON public.qc_batches (status);
CREATE INDEX IF NOT EXISTS qc_batches_spec_idx       ON public.qc_batches (spec_id);
CREATE INDEX IF NOT EXISTS qc_batches_project_idx    ON public.qc_batches (project_id);

DROP TRIGGER IF EXISTS qc_batches_set_updated_at ON public.qc_batches;
CREATE TRIGGER qc_batches_set_updated_at
  BEFORE UPDATE ON public.qc_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ──────────────────────────────────────────────────────────────
-- SECTION 4: QC TESTS
-- One row per test run against a batch. Results are JSONB so the
-- recorded parameters always match the spec at test time. A retest
-- simply adds another row; the latest row reflects current status.
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.qc_tests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        uuid NOT NULL REFERENCES public.qc_batches(id) ON DELETE CASCADE,
  -- [{ name, method, expected, unit, severity, result, pass:true|false|null, note }]
  results         jsonb NOT NULL DEFAULT '[]'::jsonb,
  overall_result  text NOT NULL DEFAULT 'pending'
                  CHECK (overall_result IN ('pass', 'fail', 'pending')),
  summary         text,
  tested_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tested_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.qc_tests IS 'A QC test run for a batch. Results captured as JSONB snapshot of the spec.';

CREATE INDEX IF NOT EXISTS qc_tests_batch_idx ON public.qc_tests (batch_id);


-- ──────────────────────────────────────────────────────────────
-- SECTION 5: DEVIATIONS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.qc_deviations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id     uuid REFERENCES public.qc_batches(id) ON DELETE SET NULL,
  title        text NOT NULL,
  description  text,
  severity     text NOT NULL DEFAULT 'major'
               CHECK (severity IN ('critical', 'major', 'minor')),
  source       text NOT NULL DEFAULT 'qc_test'
               CHECK (source IN ('qc_test', 'manual', 'complaint', 'audit')),
  root_cause   text,
  status       text NOT NULL DEFAULT 'open'
               CHECK (status IN ('open', 'investigating', 'closed')),
  raised_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.qc_deviations IS 'Deviation / non-conformance raised from a failed test or manually.';

CREATE INDEX IF NOT EXISTS qc_deviations_user_idx   ON public.qc_deviations (user_id);
CREATE INDEX IF NOT EXISTS qc_deviations_batch_idx   ON public.qc_deviations (batch_id);
CREATE INDEX IF NOT EXISTS qc_deviations_status_idx   ON public.qc_deviations (status);

DROP TRIGGER IF EXISTS qc_deviations_set_updated_at ON public.qc_deviations;
CREATE TRIGGER qc_deviations_set_updated_at
  BEFORE UPDATE ON public.qc_deviations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ──────────────────────────────────────────────────────────────
-- SECTION 6: CAPA (Corrective & Preventive Actions)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.qc_capa (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deviation_id  uuid NOT NULL REFERENCES public.qc_deviations(id) ON DELETE CASCADE,
  action_type   text NOT NULL DEFAULT 'corrective'
                CHECK (action_type IN ('corrective', 'preventive')),
  description   text NOT NULL,
  owner         text,
  due_date      date,
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'in_progress', 'done')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.qc_capa IS 'Corrective / preventive actions linked to a deviation.';

CREATE INDEX IF NOT EXISTS qc_capa_user_idx       ON public.qc_capa (user_id);
CREATE INDEX IF NOT EXISTS qc_capa_deviation_idx   ON public.qc_capa (deviation_id);

DROP TRIGGER IF EXISTS qc_capa_set_updated_at ON public.qc_capa;
CREATE TRIGGER qc_capa_set_updated_at
  BEFORE UPDATE ON public.qc_capa
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ──────────────────────────────────────────────────────────────
-- SECTION 7: ROW LEVEL SECURITY  (owner-based, mirrors existing app)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE public.qc_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_batches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_tests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_deviations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_capa           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qc_specs_owner" ON public.qc_specifications;
CREATE POLICY "qc_specs_owner" ON public.qc_specifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "qc_batches_owner" ON public.qc_batches;
CREATE POLICY "qc_batches_owner" ON public.qc_batches
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tests: accessible if the parent batch belongs to the user
DROP POLICY IF EXISTS "qc_tests_owner" ON public.qc_tests;
CREATE POLICY "qc_tests_owner" ON public.qc_tests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.qc_batches b
      WHERE b.id = qc_tests.batch_id AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "qc_deviations_owner" ON public.qc_deviations;
CREATE POLICY "qc_deviations_owner" ON public.qc_deviations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "qc_capa_owner" ON public.qc_capa;
CREATE POLICY "qc_capa_owner" ON public.qc_capa
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────────
-- SECTION 8: HELPER VIEW
-- One row per batch with its latest test result + open deviation count.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.qc_batch_overview AS
SELECT
  b.*,
  t.overall_result            AS latest_result,
  t.tested_at                 AS latest_tested_at,
  (
    SELECT count(*) FROM public.qc_deviations d
    WHERE d.batch_id = b.id AND d.status <> 'closed'
  )                           AS open_deviations
FROM public.qc_batches b
LEFT JOIN LATERAL (
  SELECT overall_result, tested_at
  FROM public.qc_tests t2
  WHERE t2.batch_id = b.id
  ORDER BY t2.tested_at DESC
  LIMIT 1
) t ON true;

COMMENT ON VIEW public.qc_batch_overview IS 'One row per batch with latest test result and open deviation count.';

-- ── END OF QC MIGRATION ──
