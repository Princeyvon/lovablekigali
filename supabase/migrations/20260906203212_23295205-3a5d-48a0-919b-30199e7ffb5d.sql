-- Themes: allow a pasted image link instead of an uploaded file
ALTER TABLE public.library_themes ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.library_themes ALTER COLUMN image_path DROP NOT NULL;

-- Accounts can be deactivated
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Build tracking for client projects
DO $$ BEGIN
  CREATE TYPE public.build_stage AS ENUM ('Planning', 'Building', 'Testing', 'Shipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS project_name text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS build_stage public.build_stage NOT NULL DEFAULT 'Shipped';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS build_started_at date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS shipped_at date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS built_by uuid REFERENCES public.team_members(id);

-- Per-page access rules
CREATE TABLE IF NOT EXISTS public.user_page_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, page_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_page_access TO authenticated;
GRANT ALL ON public.user_page_access TO service_role;

ALTER TABLE public.user_page_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own page access"
  ON public.user_page_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins manage page access"
  ON public.user_page_access FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER user_page_access_touch
  BEFORE UPDATE ON public.user_page_access
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();