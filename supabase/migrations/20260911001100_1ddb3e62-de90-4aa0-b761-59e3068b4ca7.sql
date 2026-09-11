ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS prospects_client_id_key
  ON public.prospects(client_id)
  WHERE client_id IS NOT NULL;

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name text NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  hosting_account_id uuid REFERENCES public.lovable_accounts(id) ON DELETE SET NULL,
  built_by uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  build_stage public.build_stage NOT NULL DEFAULT 'Planning',
  payment_state text NOT NULL DEFAULT 'Awaiting payment' CHECK (payment_state IN ('Awaiting payment','Partially paid','Paid','Overdue')),
  app_url text,
  started_at date,
  due_at date,
  shipped_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view projects" ON public.projects
  FOR SELECT TO authenticated USING (public.is_staff() OR public.owns_client(client_id));
CREATE POLICY "Admins and delivery can create projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_role(auth.uid(), 'dev'));
CREATE POLICY "Admins and delivery can update projects" ON public.projects
  FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_role(auth.uid(), 'dev'))
  WITH CHECK (public.is_admin() OR public.has_role(auth.uid(), 'dev'));
CREATE POLICY "Admins can delete projects" ON public.projects
  FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER projects_touch BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.link_prospect_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _client_id uuid;
BEGIN
  IF NEW.client_id IS NULL THEN
    INSERT INTO public.clients (
      business_name, contact_name, contact_email, contact_phone, industry,
      onboarded_by, status, project_name, build_stage
    ) VALUES (
      NEW.business_name, NEW.contact_name, NEW.contact_email, NEW.contact_phone, NEW.industry,
      NEW.assigned_rep, 'Active', NEW.business_name, 'Planning'
    ) RETURNING id INTO _client_id;
    NEW.client_id := _client_id;
  ELSE
    UPDATE public.clients SET
      business_name = NEW.business_name,
      contact_name = NEW.contact_name,
      contact_email = NEW.contact_email,
      contact_phone = NEW.contact_phone,
      industry = NEW.industry,
      onboarded_by = COALESCE(NEW.assigned_rep, onboarded_by)
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prospects_link_client
  BEFORE INSERT OR UPDATE OF business_name, contact_name, contact_email, contact_phone, industry, assigned_rep
  ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.link_prospect_client();

UPDATE public.prospects p
SET client_id = c.id
FROM public.clients c
WHERE p.client_id IS NULL
  AND lower(c.business_name) = lower(p.business_name);

INSERT INTO public.clients (
  business_name, contact_name, contact_email, contact_phone, industry, onboarded_by,
  status, project_name, build_stage
)
SELECT p.business_name, p.contact_name, p.contact_email, p.contact_phone, p.industry, p.assigned_rep,
       'Active', p.business_name, 'Planning'
FROM public.prospects p
WHERE p.client_id IS NULL;

UPDATE public.prospects p
SET client_id = c.id
FROM public.clients c
WHERE p.client_id IS NULL
  AND lower(c.business_name) = lower(p.business_name);

INSERT INTO public.projects (
  project_name, client_id, hosting_account_id, built_by, build_stage, app_url,
  started_at, shipped_at, payment_state
)
SELECT COALESCE(NULLIF(c.project_name, ''), c.business_name), c.id, c.hosting_account_id,
       c.built_by, c.build_stage, c.app_url, c.build_started_at, c.shipped_at,
       CASE WHEN c.app_status IN ('Suspended','Closed') THEN 'Overdue' ELSE 'Awaiting payment' END
FROM public.clients c
WHERE COALESCE(NULLIF(c.project_name, ''), c.app_url) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.projects pr WHERE pr.client_id = c.id);