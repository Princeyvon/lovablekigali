REVOKE ALL ON FUNCTION public.link_prospect_client() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_prospect_client() FROM anon;
REVOKE ALL ON FUNCTION public.link_prospect_client() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.link_prospect_client() TO service_role;

CREATE POLICY "Admin emails remain server only"
ON public.admin_emails
FOR SELECT
TO authenticated
USING (false);