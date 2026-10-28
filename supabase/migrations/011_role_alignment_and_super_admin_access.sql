-- Alinea las cuentas operativas y permite al super administrador operar todos los perfiles.
begin;

update public.role_assignments
set role = case
  when lower(email) = 'person-005@example.invalid' then 'super_admin'
  when lower(email) = 'person-001@example.invalid' then 'gcg'
  when lower(email) = 'person-002@example.invalid' then 'gerente_responsable'
  else role
end
where lower(email) in ('person-005@example.invalid', 'person-001@example.invalid', 'person-002@example.invalid');

update public.profiles
set role = case
  when lower(email) = 'person-005@example.invalid' then 'super_admin'
  when lower(email) = 'person-001@example.invalid' then 'gcg'
  when lower(email) = 'person-002@example.invalid' then 'gerente_responsable'
  else role
end
where lower(email) in ('person-005@example.invalid', 'person-001@example.invalid', 'person-002@example.invalid');

update public.organization_people
set role = case
  when lower(email) = 'person-005@example.invalid' then 'super_admin'
  when lower(email) = 'person-001@example.invalid' then 'gcg'
  when lower(email) = 'person-002@example.invalid' then 'gerente_responsable'
  else role
end
where lower(email) in ('person-005@example.invalid', 'person-001@example.invalid', 'person-002@example.invalid');

insert into public.role_assignments (email, role)
values
  ('person-005@example.invalid', 'super_admin'),
  ('person-001@example.invalid', 'gcg'),
  ('person-002@example.invalid', 'gerente_responsable')
on conflict (email) do update set role = excluded.role;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.role_assignments
    where lower(email) = lower(auth.jwt() ->> 'email')
      and role = 'super_admin'
  );
$$;

revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

create or replace function public.can_manage_reporting(indicator bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.indicators i
    join public.objectives o on o.id = i.objective_id
    where i.id = indicator
      and (public.person_matches(i.owner_email) or public.person_matches(o.owner_email))
  );
$$;

create or replace function public.can_report(indicator bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.can_manage_reporting(indicator)
    or exists (
      select 1
      from public.indicators
      where id = indicator
        and public.person_matches(reporter_email)
    );
$$;

notify pgrst, 'reload schema';
commit;
