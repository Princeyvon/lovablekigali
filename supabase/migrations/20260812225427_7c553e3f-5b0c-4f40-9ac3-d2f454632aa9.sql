
-- ENUMS
create type public.app_role as enum ('admin','sales','dev','support');
create type public.prospect_stage as enum ('Contacted','Demo','Negotiating','Signed','Lost');
create type public.client_status as enum ('Active','Paused','Churned');
create type public.note_type as enum ('General','Prompt Draft','Spec');
create type public.service_category as enum ('Bug Fix','Feature','Maintenance','Support Call');
create type public.sub_status as enum ('Active','Paused','Cancelled');
create type public.commission_type as enum ('Signing Bonus','Recurring %');
create type public.commission_status as enum ('Pending','Paid');
create type public.payout_type as enum ('Commission','Salary','Reimbursement');
create type public.payout_method as enum ('Check','Mobile Money','Bank');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin');
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid()
    and role in ('admin','dev','support'));
$$;

-- TEAM MEMBERS
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  full_name text not null,
  role text not null default 'Sales',
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.team_members to authenticated;
grant all on public.team_members to service_role;
alter table public.team_members enable row level security;

create or replace function public.my_member_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.team_members where user_id = auth.uid() limit 1;
$$;

-- ADMIN BOOTSTRAP
create table public.admin_emails (email text primary key);
insert into public.admin_emails(email) values ('admin@lovable.solutions');
alter table public.admin_emails enable row level security;
grant all on public.admin_emails to service_role;

create or replace function public.bootstrap_me()
returns app_role language plpgsql security definer set search_path = public as $$
declare _email text; _role app_role; _existing app_role;
begin
  select email into _email from auth.users where id = auth.uid();
  if _email is null then return null; end if;
  insert into public.profiles(id, email) values (auth.uid(), _email)
    on conflict (id) do update set email = excluded.email;
  select role into _existing from public.user_roles where user_id = auth.uid() limit 1;
  if _existing is not null then return _existing; end if;
  if exists (select 1 from public.admin_emails where email = _email) then
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
end; $$;

-- CLIENTS
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  industry text,
  onboarded_by uuid references public.team_members(id) on delete set null,
  signed_date date not null default current_date,
  status client_status not null default 'Active',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;

create or replace function public.owns_client(_client_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clients c
    where c.id = _client_id and c.onboarded_by = public.my_member_id()
  );
$$;

-- PROSPECTS
create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  industry text,
  contact_name text,
  contact_email text,
  contact_phone text,
  assigned_rep uuid references public.team_members(id) on delete set null,
  stage prospect_stage not null default 'Contacted',
  source text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.prospects to authenticated;
grant all on public.prospects to service_role;
alter table public.prospects enable row level security;

create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  note_type note_type not null default 'General',
  content text not null,
  created_by uuid references public.team_members(id) on delete set null,
  is_draft boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.client_notes to authenticated;
grant all on public.client_notes to service_role;
alter table public.client_notes enable row level security;

create table public.service_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  date date not null default current_date,
  category service_category not null default 'Feature',
  description text not null,
  logged_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.service_logs to authenticated;
grant all on public.service_logs to service_role;
alter table public.service_logs enable row level security;

create table public.client_system_users (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_count integer not null default 0,
  admin_name text,
  admin_contact text,
  roles_breakdown text,
  last_verified_date date,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.client_system_users to authenticated;
grant all on public.client_system_users to service_role;
alter table public.client_system_users enable row level security;

create table public.client_credentials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  service_name text not null,
  username text,
  encrypted_password text not null,
  last_rotated date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.client_credentials to authenticated;
grant all on public.client_credentials to service_role;
alter table public.client_credentials enable row level security;

create table public.credential_access_log (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.client_credentials(id) on delete cascade,
  accessed_by uuid references auth.users on delete set null,
  accessed_at timestamptz not null default now(),
  action text not null default 'view'
);
grant select, insert on public.credential_access_log to authenticated;
grant all on public.credential_access_log to service_role;
alter table public.credential_access_log enable row level security;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  monthly_rate numeric(12,2) not null default 0,
  billing_cycle text not null default 'Monthly',
  start_date date not null default current_date,
  status sub_status not null default 'Active',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_date date not null default current_date,
  months_covered integer not null default 1,
  covers_period_start date not null default current_date,
  covers_period_end date not null default (current_date + interval '1 month')::date,
  method text,
  note text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid references public.team_members(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  type commission_type not null default 'Signing Bonus',
  amount numeric(12,2) not null default 0,
  status commission_status not null default 'Pending',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.commissions to authenticated;
grant all on public.commissions to service_role;
alter table public.commissions enable row level security;

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referring_client_id uuid references public.clients(id) on delete set null,
  referring_rep_id uuid references public.team_members(id) on delete set null,
  new_prospect_id uuid references public.prospects(id) on delete set null,
  date date not null default current_date,
  reward_type text,
  reward_status text default 'Pending',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.referrals to authenticated;
grant all on public.referrals to service_role;
alter table public.referrals enable row level security;

create table public.team_payouts (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid references public.team_members(id) on delete set null,
  type payout_type not null default 'Commission',
  amount numeric(12,2) not null,
  date_sent date not null default current_date,
  method payout_method not null default 'Bank',
  reference text,
  note text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.team_payouts to authenticated;
grant all on public.team_payouts to service_role;
alter table public.team_payouts enable row level security;

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  category text not null default 'General',
  amount numeric(12,2) not null,
  vendor text,
  note text,
  paid_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;

create table public.weekly_snapshots (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  new_leads integer not null default 0,
  deals_closed integer not null default 0,
  revenue_collected numeric(12,2) not null default 0,
  active_clients integer not null default 0,
  churned_clients integer not null default 0
);
grant select, insert, update, delete on public.weekly_snapshots to authenticated;
grant all on public.weekly_snapshots to service_role;
alter table public.weekly_snapshots enable row level security;

create table public.entity_events (
  id uuid primary key default gen_random_uuid(),
  entity_table text not null,
  entity_id uuid,
  action text not null,
  change_reason text,
  actor uuid references auth.users on delete set null,
  payload jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.entity_events to authenticated;
grant all on public.entity_events to service_role;
alter table public.entity_events enable row level security;

-- POLICIES
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid());
create policy "insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());

create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_admin());

create policy "team read" on public.team_members for select to authenticated using (true);
create policy "team admin write" on public.team_members for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "prospects read" on public.prospects for select to authenticated
  using (public.is_staff() or assigned_rep = public.my_member_id());
create policy "prospects admin all" on public.prospects for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "prospects rep insert" on public.prospects for insert to authenticated
  with check (assigned_rep = public.my_member_id());
create policy "prospects rep update" on public.prospects for update to authenticated
  using (assigned_rep = public.my_member_id()) with check (assigned_rep = public.my_member_id());

create policy "clients read" on public.clients for select to authenticated
  using (public.is_staff() or onboarded_by = public.my_member_id());
create policy "clients admin all" on public.clients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "notes staff" on public.client_notes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "logs staff" on public.service_logs for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "sysusers staff" on public.client_system_users for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "creds staff" on public.client_credentials for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "cred log read" on public.credential_access_log for select to authenticated using (public.is_admin());
create policy "cred log insert" on public.credential_access_log for insert to authenticated with check (auth.uid() = accessed_by);

create policy "subs read" on public.subscriptions for select to authenticated
  using (public.is_admin() or public.owns_client(client_id));
create policy "subs admin" on public.subscriptions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "payments read" on public.payments for select to authenticated
  using (public.is_admin() or public.owns_client(client_id));
create policy "payments admin" on public.payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "commissions read" on public.commissions for select to authenticated
  using (public.is_admin() or rep_id = public.my_member_id());
create policy "commissions admin" on public.commissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "referrals read" on public.referrals for select to authenticated using (true);
create policy "referrals admin" on public.referrals for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "payouts admin" on public.team_payouts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "expenses admin" on public.expenses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "snapshots read" on public.weekly_snapshots for select to authenticated using (true);
create policy "snapshots admin" on public.weekly_snapshots for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "events read" on public.entity_events for select to authenticated using (public.is_admin());
create policy "events insert" on public.entity_events for insert to authenticated with check (auth.uid() = actor);
