CREATE TABLE public.project_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'Lovable',
  email text,
  username text,
  url text,
  encrypted_password text,
  notes text,
  lovable_account_id uuid REFERENCES public.lovable_accounts(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_accounts_project_idx ON public.project_accounts(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_accounts TO authenticated;
GRANT ALL ON public.project_accounts TO service_role;

ALTER TABLE public.project_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read project accounts" ON public.project_accounts
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "staff write project accounts" ON public.project_accounts
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "staff update project accounts" ON public.project_accounts
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "admin delete project accounts" ON public.project_accounts
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER project_accounts_touch BEFORE UPDATE ON public.project_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER audit_project_accounts AFTER INSERT OR UPDATE OR DELETE ON public.project_accounts
  FOR EACH ROW EXECUTE FUNCTION public.audit_change();
