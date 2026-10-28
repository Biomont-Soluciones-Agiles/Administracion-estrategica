-- John Cardenas pertenece a Kuntur Pharma y opera como gerente responsable.
begin;

insert into public.role_assignments (email, role)
values ('person-001@example.invalid', 'gerente_responsable')
on conflict (email) do update
set role = excluded.role,
    updated_at = now();

update public.profiles
set role = 'gerente_responsable',
    updated_at = now()
where lower(email) = 'person-001@example.invalid';

insert into public.organization_people (full_name, email, role, active)
values ('John Cardenas', 'person-001@example.invalid', 'gerente_responsable', true)
on conflict (email) do update
set full_name = excluded.full_name,
    role = excluded.role,
    active = true,
    updated_at = now();

notify pgrst, 'reload schema';
commit;
