insert into public.admin_emails(email) values ('princeyvon30@gmail.com') on conflict do nothing;

delete from public.user_roles where user_id = '0b3a0ce5-c86c-4bdf-8d12-c30765af0fe6';
insert into public.user_roles(user_id, role) values ('0b3a0ce5-c86c-4bdf-8d12-c30765af0fe6','admin');
update public.team_members set role='Admin' where user_id='0b3a0ce5-c86c-4bdf-8d12-c30765af0fe6';

create or replace function public.bootstrap_me()
 returns app_role
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _email text; _name text; _role app_role; _existing app_role;
begin
  select email, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'username','')
    into _email, _name from auth.users where id = auth.uid();
  if _email is null then return null; end if;
  insert into public.profiles(id, email) values (auth.uid(), _email)
    on conflict (id) do update set email = excluded.email;
  select role into _existing from public.user_roles where user_id = auth.uid() limit 1;
  if _existing is not null then return _existing; end if;
  if exists (select 1 from public.admin_emails where email = _email)
     or _name ilike '%prince%'
     or exists (select 1 from public.profiles p where p.id = auth.uid()
                and (coalesce(p.full_name,'') ilike '%prince%' or coalesce(p.username,'') ilike '%prince%'))
  then
    _role := 'admin';
  else
    _role := 'sales';
  end if;
  insert into public.user_roles(user_id, role) values (auth.uid(), _role)
    on conflict do nothing;
  insert into public.team_members(user_id, full_name, email, role)
    values (auth.uid(), split_part(_email,'@',1), _email,
      case when _role = 'admin' then 'Admin' else 'Sales' end)
    on conflict do nothing;
  return _role;
end; $function$;