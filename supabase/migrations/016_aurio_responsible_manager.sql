-- Directorio y acceso corporativo de Aurio de la Cruz.
begin;

insert into public.role_assignments (email, role)
values ('person-006@example.invalid', 'gerente_responsable')
on conflict (email) do update set role = excluded.role, updated_at = now();

update public.profiles set role = 'gerente_responsable', updated_at = now()
where lower(email) = 'person-006@example.invalid';

-- Conserva el ID de la persona si ya existía sin correo en el directorio.
update public.organization_people
set email = 'person-006@example.invalid', role = 'gerente_responsable', active = true, updated_at = now()
where lower(full_name) = 'aurio de la cruz'
  and not exists (select 1 from public.organization_people where lower(email) = 'person-006@example.invalid');

insert into public.organization_people (full_name, email, role, active)
values ('Aurio de la Cruz', 'person-006@example.invalid', 'gerente_responsable', true)
on conflict (email) do update set full_name = excluded.full_name, role = excluded.role, active = true, updated_at = now();

commit;
