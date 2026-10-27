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
    ('Juan Carlos Amaro', 'jamaro@biomont.com.pe', 'Gerente de Administración y Finanzas', 'Administración y Finanzas', 'Administración y Finanzas', 'gerente_responsable', true),
    ('Randolph Rafael Baca', 'rbaca@biomont.com.pe', 'Gerente Customer Experience', 'Central Comercial', 'Marketing', 'gerente_responsable', false),
    ('Jesús Alberto Cusicuna', 'jcusicuna@biomont.com.pe', 'Sub Gerente de Marketing', 'Central Comercial', 'Trade Marketing', 'gerente_responsable', false),
    ('Julio Cesar De La Vega', 'jdelavega@biomont.com.pe', 'Gerente de Supply Chain', 'Supply Chain', 'Supply Chain', 'gerente_responsable', true),
    ('Manuel Jesus Gamboa', 'mgamboa@biomont.com.pe', 'Subgerente de Calidad', 'Operaciones y Planta', 'Operaciones y Planta', 'gerente_responsable', false),
    ('Carlos Antonio Huerta', 'chuerta@biomont.com.pe', 'Gerente de TI', 'Tecnologías de la Información', 'Tecnologías de la Información', 'gerente_responsable', true),
    ('Nathalie Marcela Mas', 'nmas@biomont.com.pe', 'Gerente de Gestión Humana', 'Gestión Humana', 'Gestión Humana', 'gerente_responsable', true),
    ('Carminia Medrano', 'cmedrano@biomont.com.pe', 'Gerente Central Comercial', 'Central Comercial', 'Comercial', 'gerente_responsable', true),
    ('Aldo Santiago Pedraglio', 'apedraglio@biomont.com.pe', 'Gerente General', 'Gerencia General', 'Gerencia General', 'gerente_general', true),
    ('William Freddy Peña', 'wpena@biomont.com.pe', 'Gerente de Operaciones y Planta', 'Operaciones y Planta', 'Operaciones y Planta', 'gerente_responsable', true),
    ('Melissa Pimentel', 'mpimentel@biomont.com.pe', 'Subgerente de Mantenimiento', 'Operaciones y Planta', 'Mantenimiento', 'gerente_responsable', false),
    ('Ivan Noly Reyna', 'ireyna@biomont.com.pe', 'Subgerente Técnico Científico', 'Técnica Científica', 'Técnica Científica', 'gerente_responsable', true),
    ('Patricia Rivera', 'privera@biomont.com.pe', 'Sub Gerente de Planta', 'Operaciones y Planta', 'Planta', 'gerente_responsable', false),
    ('Helen Geraldine Salazar', 'hsalazar@biomont.com.pe', 'Subgerente de Asuntos Regulatorios', 'Asuntos Regulatorios', 'Asuntos Regulatorios', 'gerente_responsable', true),
    ('Erika Lucia Tacunan', 'etacunan@biomont.com.pe', 'Subgerente de Investigación y Desarrollo', 'Operaciones y Planta', 'Desarrollo Farmacéutico', 'gerente_responsable', false)
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
    ('Juan Carlos Amaro', 'jamaro@biomont.com.pe', 'Gerente de Administración y Finanzas', 'Administración y Finanzas', 'Administración y Finanzas', 'gerente_responsable', true),
    ('Randolph Rafael Baca', 'rbaca@biomont.com.pe', 'Gerente Customer Experience', 'Central Comercial', 'Marketing', 'gerente_responsable', false),
    ('Jesús Alberto Cusicuna', 'jcusicuna@biomont.com.pe', 'Sub Gerente de Marketing', 'Central Comercial', 'Trade Marketing', 'gerente_responsable', false),
    ('Julio Cesar De La Vega', 'jdelavega@biomont.com.pe', 'Gerente de Supply Chain', 'Supply Chain', 'Supply Chain', 'gerente_responsable', true),
    ('Manuel Jesus Gamboa', 'mgamboa@biomont.com.pe', 'Subgerente de Calidad', 'Operaciones y Planta', 'Operaciones y Planta', 'gerente_responsable', false),
    ('Carlos Antonio Huerta', 'chuerta@biomont.com.pe', 'Gerente de TI', 'Tecnologías de la Información', 'Tecnologías de la Información', 'gerente_responsable', true),
    ('Nathalie Marcela Mas', 'nmas@biomont.com.pe', 'Gerente de Gestión Humana', 'Gestión Humana', 'Gestión Humana', 'gerente_responsable', true),
    ('Carminia Medrano', 'cmedrano@biomont.com.pe', 'Gerente Central Comercial', 'Central Comercial', 'Comercial', 'gerente_responsable', true),
    ('Aldo Santiago Pedraglio', 'apedraglio@biomont.com.pe', 'Gerente General', 'Gerencia General', 'Gerencia General', 'gerente_general', true),
    ('William Freddy Peña', 'wpena@biomont.com.pe', 'Gerente de Operaciones y Planta', 'Operaciones y Planta', 'Operaciones y Planta', 'gerente_responsable', true),
    ('Melissa Pimentel', 'mpimentel@biomont.com.pe', 'Subgerente de Mantenimiento', 'Operaciones y Planta', 'Mantenimiento', 'gerente_responsable', false),
    ('Ivan Noly Reyna', 'ireyna@biomont.com.pe', 'Subgerente Técnico Científico', 'Técnica Científica', 'Técnica Científica', 'gerente_responsable', true),
    ('Patricia Rivera', 'privera@biomont.com.pe', 'Sub Gerente de Planta', 'Operaciones y Planta', 'Planta', 'gerente_responsable', false),
    ('Helen Geraldine Salazar', 'hsalazar@biomont.com.pe', 'Subgerente de Asuntos Regulatorios', 'Asuntos Regulatorios', 'Asuntos Regulatorios', 'gerente_responsable', true),
    ('Erika Lucia Tacunan', 'etacunan@biomont.com.pe', 'Subgerente de Investigación y Desarrollo', 'Operaciones y Planta', 'Desarrollo Farmacéutico', 'gerente_responsable', false)
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
  ('jamaro@biomont.com.pe', 'gerente_responsable'),
  ('rbaca@biomont.com.pe', 'gerente_responsable'),
  ('jcusicuna@biomont.com.pe', 'gerente_responsable'),
  ('jdelavega@biomont.com.pe', 'gerente_responsable'),
  ('mgamboa@biomont.com.pe', 'gerente_responsable'),
  ('chuerta@biomont.com.pe', 'gerente_responsable'),
  ('nmas@biomont.com.pe', 'gerente_responsable'),
  ('cmedrano@biomont.com.pe', 'gerente_responsable'),
  ('apedraglio@biomont.com.pe', 'gerente_general'),
  ('wpena@biomont.com.pe', 'gerente_responsable'),
  ('mpimentel@biomont.com.pe', 'gerente_responsable'),
  ('ireyna@biomont.com.pe', 'gerente_responsable'),
  ('privera@biomont.com.pe', 'gerente_responsable'),
  ('hsalazar@biomont.com.pe', 'gerente_responsable'),
  ('etacunan@biomont.com.pe', 'gerente_responsable')
on conflict (email) do update
set role = excluded.role,
    updated_at = now();

update public.profiles p
set role = r.role
from public.role_assignments r
where lower(p.email) = lower(r.email)
  and lower(r.email) in (
    'jamaro@biomont.com.pe','rbaca@biomont.com.pe','jcusicuna@biomont.com.pe',
    'jdelavega@biomont.com.pe','mgamboa@biomont.com.pe','chuerta@biomont.com.pe',
    'nmas@biomont.com.pe','cmedrano@biomont.com.pe','apedraglio@biomont.com.pe',
    'wpena@biomont.com.pe','mpimentel@biomont.com.pe','ireyna@biomont.com.pe',
    'privera@biomont.com.pe','hsalazar@biomont.com.pe','etacunan@biomont.com.pe'
  );

update public.objectives o
set responsible_management = p.management
from public.organization_people p
where o.responsible_management is null
  and lower(o.owner_email) = lower(p.email)
  and p.management is not null;

notify pgrst, 'reload schema';
commit;