-- ============================================================
-- VELITE COMPLIANCE STUDIO — Phase 2 (2-Signature Approval)
-- Safe additive migration. Run in Supabase Dashboard → SQL Editor.
-- No existing rows are affected; new columns are nullable.
-- ============================================================

-- Two-signature approval on compliance checks: Reviewer + QA.
-- The existing is_approved / approved_at / approved_by columns are kept for
-- backward compatibility. The new columns record a locked 2-signature audit
-- trail suitable for pharma (21 CFR-style).

ALTER TABLE public.checks
  ADD COLUMN IF NOT EXISTS reviewer_signed_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewer_signed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS reviewer_signed_name  text,   -- name at time of signing (never changes)
  ADD COLUMN IF NOT EXISTS qa_signed_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qa_signed_at          timestamptz,
  ADD COLUMN IF NOT EXISTS qa_signed_name        text,
  ADD COLUMN IF NOT EXISTS is_fully_approved     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fully_approved_at     timestamptz;

COMMENT ON COLUMN public.checks.reviewer_signed_by IS 'First signature (Reviewer / Packaging Compliance).';
COMMENT ON COLUMN public.checks.qa_signed_by       IS 'Second signature (QA / Quality Assurance).';
COMMENT ON COLUMN public.checks.is_fully_approved  IS 'True only when both Reviewer AND QA have signed. Locks the record from further edits.';
COMMENT ON COLUMN public.checks.reviewer_signed_name IS 'Snapshot of signer name at time of signing (immutable — used in the audit PDF).';

CREATE INDEX IF NOT EXISTS checks_is_fully_approved_idx ON public.checks (is_fully_approved);

-- ── Batch runs ────────────────────────────────────────────────────────────
-- Groups a set of compliance checks that were kicked off together (Batch Mode).
-- Purely observational — every check still stands alone in `checks`.

CREATE TABLE IF NOT EXISTS public.check_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  batch_name      text,                    -- optional, e.g. "Q3 Sunscreen Range"
  track           text NOT NULL DEFAULT 'cosmetic' CHECK (track IN ('drug','cosmetic')),
  check_type      text NOT NULL DEFAULT 'pre-print' CHECK (check_type IN ('pre-print','post-print')),
  total           integer NOT NULL DEFAULT 0,
  completed       integer NOT NULL DEFAULT 0,
  failed          integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.check_batches IS 'Bulk-check run: N SKUs uploaded together, one row per run.';

CREATE INDEX IF NOT EXISTS check_batches_user_id_idx  ON public.check_batches (user_id);
CREATE INDEX IF NOT EXISTS check_batches_project_idx  ON public.check_batches (project_id);

-- Link individual checks back to their batch
ALTER TABLE public.checks
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.check_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS checks_batch_id_idx ON public.checks (batch_id);

-- Store the full label text Claude transcribed so the ProjectDetail "Compare
-- Versions → Artwork Diff" view can show a text diff between the approved
-- artwork and the new upload. Also used by the deterministic post-checks.
ALTER TABLE public.checks
  ADD COLUMN IF NOT EXISTS extracted_text text;

COMMENT ON COLUMN public.checks.extracted_text IS 'Full text as transcribed by Claude from the label image(s). Used for artwork text diff and deterministic post-checks.';

-- RLS for check_batches (owner-only, same pattern as projects)
ALTER TABLE public.check_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "check_batches_owner" ON public.check_batches;
CREATE POLICY "check_batches_owner" ON public.check_batches
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Verify ────────────────────────────────────────────────────────────────
/*
SELECT column_name
FROM information_schema.columns
WHERE table_schema='public' AND table_name='checks'
  AND column_name IN ('reviewer_signed_by','qa_signed_by','is_fully_approved','batch_id');
-- expect 4 rows

SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name='check_batches';
-- expect 1 row
*/

-- ── END ──
