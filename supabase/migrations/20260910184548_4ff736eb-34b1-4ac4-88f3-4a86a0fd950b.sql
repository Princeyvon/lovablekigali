CREATE TABLE public.lovable_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  label text,
  encrypted_password text,
  recovery_email text,
  plan text,
  credits_remaining numeric NOT NULL DEFAULT 0,
  credits_checked_at date,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lovable_accounts TO authenticated;
GRANT ALL ON public.lovable_accounts TO service_role;
ALTER TABLE public.lovable_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage lovable accounts" ON public.lovable_accounts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Staff can read lovable accounts" ON public.lovable_accounts FOR SELECT TO authenticated USING (public.is_staff());
CREATE TRIGGER lovable_accounts_touch BEFORE UPDATE ON public.lovable_accounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.clients ADD COLUMN hosting_account_id uuid REFERENCES public.lovable_accounts(id) ON DELETE SET NULL;

CREATE TABLE public.project_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  from_account_id uuid REFERENCES public.lovable_accounts(id) ON DELETE SET NULL,
  to_account_id uuid REFERENCES public.lovable_accounts(id) ON DELETE SET NULL,
  moved_at timestamptz NOT NULL DEFAULT now(),
  moved_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.project_transfers TO authenticated;
GRANT ALL ON public.project_transfers TO service_role;
ALTER TABLE public.project_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read transfers" ON public.project_transfers FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Admins log transfers" ON public.project_transfers FOR INSERT TO authenticated WITH CHECK (public.is_admin());