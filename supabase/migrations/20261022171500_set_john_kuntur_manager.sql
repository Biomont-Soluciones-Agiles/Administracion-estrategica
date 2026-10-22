-- John Cardenas pertenece a Kuntur Pharma y opera como gerente responsable.
begin;

insert into public.role_assignments (email, role)
values ('jcardenas@biomont.com.pe', 'gerente_responsable')
on conflict (email) do update
set role = excluded.role,
    updated_at = now();

update public.profiles
set role = 'gerente_responsable',
    updated_at = now()
where lower(email) = 'jcardenas@biomont.com.pe';

insert into public.organization_people (full_name, email, role, active)
values ('John Cardenas', 'jcardenas@biomont.com.pe', 'gerente_responsable', true)
on conflict (email) do update
set full_name = excluded.full_name,
    role = excluded.role,
    active = true,
    updated_at = now();

notify pgrst, 'reload schema';
commit;
