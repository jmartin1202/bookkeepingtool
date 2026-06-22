-- Month-End Document Chaser core schema for Supabase Postgres.
-- Run in Supabase SQL editor or through `supabase db push`.

create extension if not exists pgcrypto;

do $$
begin
  create type app_role as enum ('owner', 'staff');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type client_status as enum ('active', 'archived');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type cycle_status as enum ('open', 'complete', 'archived');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type request_status as enum ('missing', 'uploaded', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type reminder_channel as enum ('email', 'sms');
exception when duplicate_object then null;
end $$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text,
  role app_role not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status subscription_status not null default 'incomplete',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  contact_email text not null,
  contact_phone text,
  status client_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  label text not null,
  description text,
  sort_order int not null default 0,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collection_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  template_id uuid not null references public.checklist_templates(id),
  period_month date not null,
  due_date date not null,
  status cycle_status not null default 'open',
  public_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, client_id, period_month)
);

create table public.document_requests (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.collection_cycles(id) on delete cascade,
  checklist_item_id uuid references public.checklist_items(id) on delete set null,
  label text not null,
  description text,
  sort_order int not null default 0,
  required boolean not null default true,
  status request_status not null default 'missing',
  last_reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, checklist_item_id)
);

create table public.document_uploads (
  id uuid primary key default gen_random_uuid(),
  document_request_id uuid not null references public.document_requests(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  file_size int not null check (file_size > 0),
  uploaded_by_email text not null,
  created_at timestamptz not null default now()
);

create table public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.collection_cycles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  channel reminder_channel not null default 'email',
  status text not null,
  error_message text,
  sent_at timestamptz not null default now()
);

create index clients_org_idx on public.clients (organization_id);
create index checklist_templates_org_idx on public.checklist_templates (organization_id);
create index checklist_items_template_idx on public.checklist_items (template_id, sort_order);
create index collection_cycles_org_status_idx on public.collection_cycles (organization_id, status);
create index collection_cycles_public_token_idx on public.collection_cycles (public_token);
create index document_requests_cycle_status_idx on public.document_requests (cycle_id, status, sort_order);
create index document_uploads_request_idx on public.document_uploads (document_request_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_organizations_updated_at before update on public.organizations
for each row execute function public.set_updated_at();

create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_subscriptions_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();

create trigger set_clients_updated_at before update on public.clients
for each row execute function public.set_updated_at();

create trigger set_checklist_templates_updated_at before update on public.checklist_templates
for each row execute function public.set_updated_at();

create trigger set_checklist_items_updated_at before update on public.checklist_items
for each row execute function public.set_updated_at();

create trigger set_collection_cycles_updated_at before update on public.collection_cycles
for each row execute function public.set_updated_at();

create trigger set_document_requests_updated_at before update on public.document_requests
for each row execute function public.set_updated_at();

-- Private bucket for client-uploaded documents.
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

-- Row-level security keeps each firm isolated.
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.clients enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_items enable row level security;
alter table public.collection_cycles enable row level security;
alter table public.document_requests enable row level security;
alter table public.document_uploads enable row level security;
alter table public.reminder_logs enable row level security;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

create policy "members can read their organization"
on public.organizations for select
using (id = public.current_organization_id());

create policy "members can read profiles in their organization"
on public.profiles for select
using (organization_id = public.current_organization_id());

create policy "members can read their subscription"
on public.subscriptions for select
using (organization_id = public.current_organization_id());

create policy "members can manage clients"
on public.clients for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members can manage templates"
on public.checklist_templates for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members can manage template items"
on public.checklist_items for all
using (
  exists (
    select 1
    from public.checklist_templates t
    where t.id = checklist_items.template_id
      and t.organization_id = public.current_organization_id()
  )
)
with check (
  exists (
    select 1
    from public.checklist_templates t
    where t.id = checklist_items.template_id
      and t.organization_id = public.current_organization_id()
  )
);

create policy "members can manage collection cycles"
on public.collection_cycles for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members can manage document requests"
on public.document_requests for all
using (
  exists (
    select 1
    from public.collection_cycles c
    where c.id = document_requests.cycle_id
      and c.organization_id = public.current_organization_id()
  )
)
with check (
  exists (
    select 1
    from public.collection_cycles c
    where c.id = document_requests.cycle_id
      and c.organization_id = public.current_organization_id()
  )
);

create policy "members can read uploaded documents"
on public.document_uploads for select
using (
  exists (
    select 1
    from public.document_requests dr
    join public.collection_cycles c on c.id = dr.cycle_id
    where dr.id = document_uploads.document_request_id
      and c.organization_id = public.current_organization_id()
  )
);

create policy "members can read reminder logs"
on public.reminder_logs for select
using (exists (
  select 1
  from public.collection_cycles c
  where c.id = reminder_logs.cycle_id
    and c.organization_id = public.current_organization_id()
));

-- Atomic core action:
-- Create or update one monthly collection cycle, clone template items into request rows,
-- and return the secure client upload path.
create or replace function public.create_collection_cycle(
  p_client_id uuid,
  p_template_id uuid,
  p_period_month date,
  p_due_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_cycle public.collection_cycles;
  v_request_count int;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select organization_id into v_org_id
  from public.profiles
  where id = v_user_id;

  if v_org_id is null then
    raise exception 'Profile is missing an organization' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.subscriptions
    where organization_id = v_org_id
      and status in ('trialing', 'active')
      and (current_period_end is null or current_period_end > now())
  ) then
    raise exception 'Active subscription required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.clients
    where id = p_client_id
      and organization_id = v_org_id
      and status = 'active'
  ) then
    raise exception 'Client not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.checklist_templates
    where id = p_template_id
      and organization_id = v_org_id
  ) then
    raise exception 'Checklist template not found' using errcode = 'P0002';
  end if;

  insert into public.collection_cycles (
    organization_id,
    client_id,
    template_id,
    period_month,
    due_date
  )
  values (
    v_org_id,
    p_client_id,
    p_template_id,
    date_trunc('month', p_period_month)::date,
    p_due_date
  )
  on conflict (organization_id, client_id, period_month)
  do update set
    template_id = excluded.template_id,
    due_date = excluded.due_date,
    updated_at = now()
  returning * into v_cycle;

  insert into public.document_requests (
    cycle_id,
    checklist_item_id,
    label,
    description,
    sort_order,
    required
  )
  select
    v_cycle.id,
    item.id,
    item.label,
    item.description,
    item.sort_order,
    item.required
  from public.checklist_items item
  where item.template_id = p_template_id
  on conflict (cycle_id, checklist_item_id)
  do update set
    label = excluded.label,
    description = excluded.description,
    sort_order = excluded.sort_order,
    required = excluded.required,
    updated_at = now();

  select count(*) into v_request_count
  from public.document_requests
  where cycle_id = v_cycle.id;

  return jsonb_build_object(
    'id', v_cycle.id,
    'clientId', v_cycle.client_id,
    'templateId', v_cycle.template_id,
    'periodMonth', v_cycle.period_month,
    'dueDate', v_cycle.due_date,
    'status', v_cycle.status,
    'publicToken', v_cycle.public_token,
    'uploadPath', '/portal/' || v_cycle.public_token,
    'requestCount', v_request_count
  );
end;
$$;
