-- Creates an organization, owner profile, and trial subscription whenever a
-- Supabase Auth user signs up. This keeps app onboarding out of client code.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_full_name text;
  v_org_name text;
begin
  v_full_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');
  v_org_name := nullif(trim(coalesce(new.raw_user_meta_data->>'organization_name', '')), '');

  if v_full_name is null then
    v_full_name := split_part(new.email, '@', 1);
  end if;

  if v_org_name is null then
    v_org_name := v_full_name || '''s Firm';
  end if;

  insert into public.organizations (name, owner_user_id)
  values (v_org_name, new.id)
  returning id into v_org_id;

  insert into public.profiles (id, organization_id, full_name, role)
  values (new.id, v_org_id, v_full_name, 'owner');

  insert into public.subscriptions (
    organization_id,
    status,
    current_period_end
  )
  values (
    v_org_id,
    'trialing',
    now() + interval '14 days'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop policy if exists "owners can update their organization" on public.organizations;
drop policy if exists "members can update their own profile" on public.profiles;

create policy "owners can update their organization"
on public.organizations for update
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy "members can update their own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid() and organization_id = public.current_organization_id());
