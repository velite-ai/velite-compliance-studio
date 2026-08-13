-- ============================================================
-- VELITE COMPLIANCE STUDIO — Storage RLS Policies
-- Run this in Supabase SQL Editor.
--
-- Fix for: "Upload failed: new row violates row-level security policy"
-- when uploading project assets from the Project Detail → Assets tab.
--
-- Why this is needed:
--   Supabase Storage buckets are gated by RLS on the storage.objects table.
--   A newly-created bucket has NO policies, so only the service_role key can
--   read/write. Authenticated users (the logged-in app) cannot upload until
--   we add policies that allow them to.
--
-- Buckets this file covers:
--   - labels       (already exists — used by compliance checks)
--   - assets       (per-project asset library — Module 5)
--   - guidelines   (internal Velite SOPs/brand standards — Module 7A)
--   - reports      (generated compliance PDFs + annotated images — Module 6)
--
-- Before running, make sure the buckets exist:
--   Supabase Dashboard → Storage → New Bucket
--   Name: assets / guidelines / reports
--   Public: OFF (private)
--   File size limit: 50 MB
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. Make sure RLS is enabled on storage.objects (it is by default,
--    but this is safe to re-run)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;


-- ──────────────────────────────────────────────────────────────
-- 2. ASSETS bucket
--    Used by: src/pages/ProjectDetail.jsx (Assets tab upload)
--    Path layout: {project_id}/{asset_type}/{uuid}_{filename}
--
--    Policy strategy:
--      - Any authenticated user owning the parent project can read/write.
--      - We verify ownership by joining the path's first segment
--        (project_id) against the projects table.
-- ──────────────────────────────────────────────────────────────

-- SELECT (read / generate signed URLs)
DROP POLICY IF EXISTS "assets_select_own_project" ON storage.objects;
CREATE POLICY "assets_select_own_project"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'assets'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = ((storage.foldername(name))[1])::uuid
        AND p.user_id = auth.uid()
    )
  );

-- INSERT (upload)
DROP POLICY IF EXISTS "assets_insert_own_project" ON storage.objects;
CREATE POLICY "assets_insert_own_project"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'assets'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = ((storage.foldername(name))[1])::uuid
        AND p.user_id = auth.uid()
    )
  );

-- UPDATE (rename / replace)
DROP POLICY IF EXISTS "assets_update_own_project" ON storage.objects;
CREATE POLICY "assets_update_own_project"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'assets'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = ((storage.foldername(name))[1])::uuid
        AND p.user_id = auth.uid()
    )
  );

-- DELETE
DROP POLICY IF EXISTS "assets_delete_own_project" ON storage.objects;
CREATE POLICY "assets_delete_own_project"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'assets'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = ((storage.foldername(name))[1])::uuid
        AND p.user_id = auth.uid()
    )
  );


-- ──────────────────────────────────────────────────────────────
-- 3. GUIDELINES bucket (Module 7A — Internal Guidelines)
--    Any authenticated user can read/write. Internal SOPs are shared.
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "guidelines_select_auth" ON storage.objects;
CREATE POLICY "guidelines_select_auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'guidelines');

DROP POLICY IF EXISTS "guidelines_insert_auth" ON storage.objects;
CREATE POLICY "guidelines_insert_auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'guidelines');

DROP POLICY IF EXISTS "guidelines_update_auth" ON storage.objects;
CREATE POLICY "guidelines_update_auth"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'guidelines');

DROP POLICY IF EXISTS "guidelines_delete_auth" ON storage.objects;
CREATE POLICY "guidelines_delete_auth"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'guidelines');


-- ──────────────────────────────────────────────────────────────
-- 4. REPORTS bucket (Module 6 — generated PDFs and annotated images)
--    Any authenticated user can read/write.
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "reports_select_auth" ON storage.objects;
CREATE POLICY "reports_select_auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'reports');

DROP POLICY IF EXISTS "reports_insert_auth" ON storage.objects;
CREATE POLICY "reports_insert_auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reports');

DROP POLICY IF EXISTS "reports_update_auth" ON storage.objects;
CREATE POLICY "reports_update_auth"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'reports');

DROP POLICY IF EXISTS "reports_delete_auth" ON storage.objects;
CREATE POLICY "reports_delete_auth"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'reports');


-- ──────────────────────────────────────────────────────────────
-- 5. LABELS bucket (existing — used by NewCheck.jsx)
--    Make sure the existing compliance check upload still works
--    for authenticated users. Safe re-run.
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "labels_select_auth" ON storage.objects;
CREATE POLICY "labels_select_auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'labels');

DROP POLICY IF EXISTS "labels_insert_auth" ON storage.objects;
CREATE POLICY "labels_insert_auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'labels');

DROP POLICY IF EXISTS "labels_update_auth" ON storage.objects;
CREATE POLICY "labels_update_auth"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'labels');

DROP POLICY IF EXISTS "labels_delete_auth" ON storage.objects;
CREATE POLICY "labels_delete_auth"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'labels');


-- ──────────────────────────────────────────────────────────────
-- 6. VERIFY
-- ──────────────────────────────────────────────────────────────
/*
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
*/

-- ── END ──
