-- Fabrizio Leon deja la vista GCG y pasa a Gerente responsable.
-- Se actualizan tanto las nuevas sesiones como su perfil existente y el directorio.
begin;

insert into public.role_assignments (email, role)
values ('person-003@example.invalid', 'gerente_responsable')
on conflict (email) do update set
  role = excluded.role,
  updated_at = now();

update public.profiles
set role = 'gerente_responsable', updated_at = now()
where lower(email) = 'person-003@example.invalid';

insert into public.organization_people (full_name, email, role, active)
values ('Fabrizio Leon', 'person-003@example.invalid', 'gerente_responsable', true)
on conflict (full_name) do update set
  email = excluded.email,
  role = excluded.role,
  active = true,
  updated_at = now();

commit;
