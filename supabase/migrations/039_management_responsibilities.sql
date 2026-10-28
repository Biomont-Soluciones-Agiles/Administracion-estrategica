-- Directorio de gerencias responsables y asignación automática de Biomont.
begin;

alter table public.organization_people
  add column if not exists job_title text,
  add column if not exists management text,
  add column if not exists submanagement text,
  add column if not exists is_management_lead boolean not null default false;

alter table public.organization_people drop constraint if exists organization_people_role_check;
alter table public.organization_people
  add constraint organization_people_role_check
  check (role in ('gerente_responsable', 'gcg', 'super_admin', 'gerente_general', 'usuario'));

alter table public.objectives
  add column if not exists responsible_management text;

with directory(full_name, email, job_title, management, submanagement, role, is_management_lead) as (
  values
    ('Juan Carlos Amaro', 'person-008@example.invalid', 'Gerente de Administración y Finanzas', 'Administración y Finanzas', 'Administración y Finanzas', 'gerente_responsable', true),
    ('Randolph Rafael Baca', 'person-019@example.invalid', 'Gerente Customer Experience', 'Central Comercial', 'Marketing', 'gerente_responsable', false),
    ('Jesús Alberto Cusicuna', 'person-014@example.invalid', 'Sub Gerente de Marketing', 'Central Comercial', 'Trade Marketing', 'gerente_responsable', false),
    ('Julio Cesar De La Vega', 'person-010@example.invalid', 'Gerente de Supply Chain', 'Supply Chain', 'Supply Chain', 'gerente_responsable', true),
    ('Manuel Jesus Gamboa', 'person-020@example.invalid', 'Subgerente de Calidad', 'Operaciones y Planta', 'Operaciones y Planta', 'gerente_responsable', false),
    ('Carlos Antonio Huerta', 'person-015@example.invalid', 'Gerente de TI', 'Tecnologías de la Información', 'Tecnologías de la Información', 'gerente_responsable', true),
    ('Nathalie Marcela Mas', 'person-011@example.invalid', 'Gerente de Gestión Humana', 'Gestión Humana', 'Gestión Humana', 'gerente_responsable', true),
    ('Carminia Medrano', 'person-009@example.invalid', 'Gerente Central Comercial', 'Central Comercial', 'Comercial', 'gerente_responsable', true),
    ('Aldo Santiago Pedraglio', 'person-007@example.invalid', 'Gerente General', 'Gerencia General', 'Gerencia General', 'gerente_general', true),
    ('William Freddy Peña', 'person-012@example.invalid', 'Gerente de Operaciones y Planta', 'Operaciones y Planta', 'Operaciones y Planta', 'gerente_responsable', true),
    ('Melissa Pimentel', 'person-021@example.invalid', 'Subgerente de Mantenimiento', 'Operaciones y Planta', 'Mantenimiento', 'gerente_responsable', false),
    ('Ivan Noly Reyna', 'person-013@example.invalid', 'Subgerente Técnico Científico', 'Técnica Científica', 'Técnica Científica', 'gerente_responsable', true),
    ('Patricia Rivera', 'person-022@example.invalid', 'Sub Gerente de Planta', 'Operaciones y Planta', 'Planta', 'gerente_responsable', false),
    ('Helen Geraldine Salazar', 'person-023@example.invalid', 'Subgerente de Asuntos Regulatorios', 'Asuntos Regulatorios', 'Asuntos Regulatorios', 'gerente_responsable', true),
    ('Erika Lucia Tacunan', 'person-024@example.invalid', 'Subgerente de Investigación y Desarrollo', 'Operaciones y Planta', 'Desarrollo Farmacéutico', 'gerente_responsable', false)
)
update public.organization_people p
set full_name = d.full_name,
    email = d.email,
    job_title = d.job_title,
    management = d.management,
    submanagement = d.submanagement,
    role = d.role,
    is_management_lead = d.is_management_lead,
    active = true,
    updated_at = now()
from directory d
where lower(coalesce(p.email, '')) = lower(d.email)
   or lower(p.full_name) = lower(d.full_name);

with directory(full_name, email, job_title, management, submanagement, role, is_management_lead) as (
  values
    ('Juan Carlos Amaro', 'person-008@example.invalid', 'Gerente de Administración y Finanzas', 'Administración y Finanzas', 'Administración y Finanzas', 'gerente_responsable', true),
    ('Randolph Rafael Baca', 'person-019@example.invalid', 'Gerente Customer Experience', 'Central Comercial', 'Marketing', 'gerente_responsable', false),
    ('Jesús Alberto Cusicuna', 'person-014@example.invalid', 'Sub Gerente de Marketing', 'Central Comercial', 'Trade Marketing', 'gerente_responsable', false),
    ('Julio Cesar De La Vega', 'person-010@example.invalid', 'Gerente de Supply Chain', 'Supply Chain', 'Supply Chain', 'gerente_responsable', true),
    ('Manuel Jesus Gamboa', 'person-020@example.invalid', 'Subgerente de Calidad', 'Operaciones y Planta', 'Operaciones y Planta', 'gerente_responsable', false),
    ('Carlos Antonio Huerta', 'person-015@example.invalid', 'Gerente de TI', 'Tecnologías de la Información', 'Tecnologías de la Información', 'gerente_responsable', true),
    ('Nathalie Marcela Mas', 'person-011@example.invalid', 'Gerente de Gestión Humana', 'Gestión Humana', 'Gestión Humana', 'gerente_responsable', true),
    ('Carminia Medrano', 'person-009@example.invalid', 'Gerente Central Comercial', 'Central Comercial', 'Comercial', 'gerente_responsable', true),
    ('Aldo Santiago Pedraglio', 'person-007@example.invalid', 'Gerente General', 'Gerencia General', 'Gerencia General', 'gerente_general', true),
    ('William Freddy Peña', 'person-012@example.invalid', 'Gerente de Operaciones y Planta', 'Operaciones y Planta', 'Operaciones y Planta', 'gerente_responsable', true),
    ('Melissa Pimentel', 'person-021@example.invalid', 'Subgerente de Mantenimiento', 'Operaciones y Planta', 'Mantenimiento', 'gerente_responsable', false),
    ('Ivan Noly Reyna', 'person-013@example.invalid', 'Subgerente Técnico Científico', 'Técnica Científica', 'Técnica Científica', 'gerente_responsable', true),
    ('Patricia Rivera', 'person-022@example.invalid', 'Sub Gerente de Planta', 'Operaciones y Planta', 'Planta', 'gerente_responsable', false),
    ('Helen Geraldine Salazar', 'person-023@example.invalid', 'Subgerente de Asuntos Regulatorios', 'Asuntos Regulatorios', 'Asuntos Regulatorios', 'gerente_responsable', true),
    ('Erika Lucia Tacunan', 'person-024@example.invalid', 'Subgerente de Investigación y Desarrollo', 'Operaciones y Planta', 'Desarrollo Farmacéutico', 'gerente_responsable', false)
)
insert into public.organization_people (full_name, email, job_title, management, submanagement, role, is_management_lead, active)
select d.full_name, d.email, d.job_title, d.management, d.submanagement, d.role, d.is_management_lead, true
from directory d
where not exists (
  select 1 from public.organization_people p
  where lower(coalesce(p.email, '')) = lower(d.email)
     or lower(p.full_name) = lower(d.full_name)
);

insert into public.role_assignments(email, role)
values
  ('person-008@example.invalid', 'gerente_responsable'),
  ('person-019@example.invalid', 'gerente_responsable'),
  ('person-014@example.invalid', 'gerente_responsable'),
  ('person-010@example.invalid', 'gerente_responsable'),
  ('person-020@example.invalid', 'gerente_responsable'),
  ('person-015@example.invalid', 'gerente_responsable'),
  ('person-011@example.invalid', 'gerente_responsable'),
  ('person-009@example.invalid', 'gerente_responsable'),
  ('person-007@example.invalid', 'gerente_general'),
  ('person-012@example.invalid', 'gerente_responsable'),
  ('person-021@example.invalid', 'gerente_responsable'),
  ('person-013@example.invalid', 'gerente_responsable'),
  ('person-022@example.invalid', 'gerente_responsable'),
  ('person-023@example.invalid', 'gerente_responsable'),
  ('person-024@example.invalid', 'gerente_responsable')
on conflict (email) do update
set role = excluded.role,
    updated_at = now();

update public.profiles p
set role = r.role
from public.role_assignments r
where lower(p.email) = lower(r.email)
  and lower(r.email) in (
    'person-008@example.invalid','person-019@example.invalid','person-014@example.invalid',
    'person-010@example.invalid','person-020@example.invalid','person-015@example.invalid',
    'person-011@example.invalid','person-009@example.invalid','person-007@example.invalid',
    'person-012@example.invalid','person-021@example.invalid','person-013@example.invalid',
    'person-022@example.invalid','person-023@example.invalid','person-024@example.invalid'
  );

update public.objectives o
set responsible_management = p.management
from public.organization_people p
where o.responsible_management is null
  and lower(o.owner_email) = lower(p.email)
  and p.management is not null;

notify pgrst, 'reload schema';
commit;