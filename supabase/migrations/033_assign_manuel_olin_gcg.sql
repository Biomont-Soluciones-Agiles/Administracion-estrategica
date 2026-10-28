-- Asigna acceso GCG a Manuel Freddy Olin Ponte.
begin;

insert into public.role_assignments(email, role)
values ('person-002@example.invalid', 'gcg')
on conflict (email) do update set role = excluded.role;

update public.profiles
set role = 'gcg', updated_at = now()
where lower(email) = 'person-002@example.invalid';

update public.organization_people
set role = 'gcg', updated_at = now()
where lower(email) = 'person-002@example.invalid';

notify pgrst, 'reload schema';
commit;
