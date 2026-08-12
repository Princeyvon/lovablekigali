
revoke execute on function public.has_role(uuid, public.app_role) from anon, public;
revoke execute on function public.is_admin() from anon, public;
revoke execute on function public.is_staff() from anon, public;
revoke execute on function public.my_member_id() from anon, public;
revoke execute on function public.owns_client(uuid) from anon, public;
revoke execute on function public.bootstrap_me() from anon, public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.my_member_id() to authenticated;
grant execute on function public.owns_client(uuid) to authenticated;
grant execute on function public.bootstrap_me() to authenticated;
