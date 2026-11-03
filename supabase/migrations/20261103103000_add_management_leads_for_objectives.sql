-- Nuevas gerencias responsables disponibles al crear y editar objetivos.
begin;

with leaders(email, management, job_title) as (
  values
    ('jcusicuna@biomont.com.pe', 'Subgerencia de Marketing', 'Subgerente de Marketing'),
    ('rbaca@biomont.com.pe', 'Gerencia de Customer Experience', 'Gerente de Customer Experience'),
    ('adelacruz@biomont.com.pe', 'Jefatura de la Oficina de Proyectos', 'Jefe de la Oficina de Proyectos')
)
update public.organization_people person
set management = leaders.management,
    job_title = leaders.job_title,
    submanagement = leaders.management,
    role = 'gerente_responsable',
    is_management_lead = true,
    active = true,
    updated_at = now()
from leaders
where lower(person.email) = lower(leaders.email);

insert into public.role_assignments (email, role)
values
  ('jcusicuna@biomont.com.pe', 'gerente_responsable'),
  ('rbaca@biomont.com.pe', 'gerente_responsable'),
  ('adelacruz@biomont.com.pe', 'gerente_responsable')
on conflict (email) do update
set role = excluded.role,
    updated_at = now();

update public.profiles profile
set role = 'gerente_responsable'
where lower(profile.email) in (
  'jcusicuna@biomont.com.pe',
  'rbaca@biomont.com.pe',
  'adelacruz@biomont.com.pe'
);

notify pgrst, 'reload schema';
commit;
