-- Directorio y roles autorizados para el acceso a BIOMET.
-- Los correos externos requieren ser invitados B2B en Microsoft Entra ID de Biomont.
begin;

with authorized_people(full_name, email, role) as (
  values
    ('Aldo Pedraglio', 'person-007@example.invalid', 'gcg'),
    ('Juan Carlos Amaro', 'person-008@example.invalid', 'gerente_responsable'),
    ('Claudia Urbina', 'person-004@example.invalid', 'gcg'),
    ('Carmina Mercado', 'person-009@example.invalid', 'gerente_responsable'),
    ('Julio De la Vega', 'person-010@example.invalid', 'gerente_responsable'),
    ('Nathalie Mena', 'person-011@example.invalid', 'gerente_responsable'),
    ('William Peña', 'person-012@example.invalid', 'gerente_responsable'),
    ('Ivan Reyna', 'person-013@example.invalid', 'gerente_responsable'),
    ('Jesus Chulluni', 'person-014@example.invalid', 'gerente_responsable'),
    ('Carlos Huerta', 'person-015@example.invalid', 'gerente_responsable'),
    ('Angel Pérez (Ecuador)', 'person-016@example.invalid', 'gerente_responsable'),
    ('Chiara Pedraglio (Kuntur)', 'person-017@example.invalid', 'gerente_responsable')
)
insert into public.role_assignments (email, role)
select email, role from authorized_people
on conflict (email) do update set role = excluded.role, updated_at = now();

with authorized_people(full_name, email, role) as (
  values
    ('Aldo Pedraglio', 'person-007@example.invalid', 'gcg'),
    ('Juan Carlos Amaro', 'person-008@example.invalid', 'gerente_responsable'),
    ('Claudia Urbina', 'person-004@example.invalid', 'gcg'),
    ('Carmina Mercado', 'person-009@example.invalid', 'gerente_responsable'),
    ('Julio De la Vega', 'person-010@example.invalid', 'gerente_responsable'),
    ('Nathalie Mena', 'person-011@example.invalid', 'gerente_responsable'),
    ('William Peña', 'person-012@example.invalid', 'gerente_responsable'),
    ('Ivan Reyna', 'person-013@example.invalid', 'gerente_responsable'),
    ('Jesus Chulluni', 'person-014@example.invalid', 'gerente_responsable'),
    ('Carlos Huerta', 'person-015@example.invalid', 'gerente_responsable'),
    ('Angel Pérez (Ecuador)', 'person-016@example.invalid', 'gerente_responsable'),
    ('Chiara Pedraglio (Kuntur)', 'person-017@example.invalid', 'gerente_responsable')
)
update public.profiles profile
set role = person.role, updated_at = now()
from authorized_people person
where lower(profile.email) = person.email;

with authorized_people(full_name, email, role) as (
  values
    ('Aldo Pedraglio', 'person-007@example.invalid', 'gcg'),
    ('Juan Carlos Amaro', 'person-008@example.invalid', 'gerente_responsable'),
    ('Claudia Urbina', 'person-004@example.invalid', 'gcg'),
    ('Carmina Mercado', 'person-009@example.invalid', 'gerente_responsable'),
    ('Julio De la Vega', 'person-010@example.invalid', 'gerente_responsable'),
    ('Nathalie Mena', 'person-011@example.invalid', 'gerente_responsable'),
    ('William Peña', 'person-012@example.invalid', 'gerente_responsable'),
    ('Ivan Reyna', 'person-013@example.invalid', 'gerente_responsable'),
    ('Jesus Chulluni', 'person-014@example.invalid', 'gerente_responsable'),
    ('Carlos Huerta', 'person-015@example.invalid', 'gerente_responsable'),
    ('Angel Pérez (Ecuador)', 'person-016@example.invalid', 'gerente_responsable'),
    ('Chiara Pedraglio (Kuntur)', 'person-017@example.invalid', 'gerente_responsable')
)
insert into public.organization_people (full_name, email, role, active)
select full_name, email, role, true from authorized_people
on conflict (full_name) do update set email = excluded.email, role = excluded.role, active = true, updated_at = now();

commit;
