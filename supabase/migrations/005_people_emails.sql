-- Correos corporativos asociados al directorio de personas.
insert into public.organization_people (full_name, email, role) values
  ('Claudia Urbina', 'person-004@example.invalid', 'gerente_responsable'),
  ('Manuel Olin', 'person-002@example.invalid', 'gerente_responsable'),
  ('Jhon Cardenas', 'person-001@example.invalid', 'gerente_responsable')
on conflict (full_name) do update set
  email = excluded.email,
  active = true,
  updated_at = now();
