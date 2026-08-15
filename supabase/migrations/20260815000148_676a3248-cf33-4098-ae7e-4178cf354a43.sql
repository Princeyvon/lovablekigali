REVOKE ALL ON FUNCTION public.mirror_payment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mirror_expense() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mirror_payout() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;