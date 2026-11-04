-- Carga masiva de objetivos e indicadores y responsables disponibles en todas las sedes.
begin;

create table if not exists public.site_responsibles (
  site_id bigint not null references public.sites(id) on delete cascade,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (site_id, email)
);
alter table public.site_responsibles enable row level security;
drop policy if exists "Read site responsibles" on public.site_responsibles;
drop policy if exists "GCG manages site responsibles" on public.site_responsibles;
create policy "Read site responsibles" on public.site_responsibles for select to authenticated using (true);
create policy "GCG manages site responsibles" on public.site_responsibles for all to authenticated using (is_gcg()) with check (is_gcg());

-- Normaliza las gerencias que llegan del archivo de planificación.
update public.organization_people
set management = case lower(email)
  when 'person-008@example.invalid' then 'Administración y Finanzas'
  when 'person-009@example.invalid' then 'Central Comercial'
  when 'person-010@example.invalid' then 'Supply Chain'
  when 'person-012@example.invalid' then 'Operaciones y Planta'
  when 'person-015@example.invalid' then 'Tecnología de la Información'
  when 'chuerta@biomont.com.pe' then 'Tecnología de la Información'
  when 'person-011@example.invalid' then 'Gestión Humana'
  when 'jcusicuna@biomont.com.pe' then 'Subgerencia de Marketing'
  when 'rbaca@biomont.com.pe' then 'Gerencia de Customer Experience'
  when 'adelacruz@biomont.com.pe' then 'Jefatura de la Oficina de Proyectos'
  else management
end,
is_management_lead = case
  when lower(email) in (
    'person-008@example.invalid', 'person-009@example.invalid', 'person-010@example.invalid',
    'person-012@example.invalid', 'person-015@example.invalid', 'chuerta@biomont.com.pe', 'person-011@example.invalid',
    'jcusicuna@biomont.com.pe', 'rbaca@biomont.com.pe', 'adelacruz@biomont.com.pe'
  ) then true
  else is_management_lead
end,
updated_at = now()
where lower(email) in (
  'person-008@example.invalid', 'person-009@example.invalid', 'person-010@example.invalid',
  'person-012@example.invalid', 'person-015@example.invalid', 'chuerta@biomont.com.pe', 'person-011@example.invalid',
  'jcusicuna@biomont.com.pe', 'rbaca@biomont.com.pe', 'adelacruz@biomont.com.pe'
);

-- Los responsables de gerencia pueden ser seleccionados para Biomont, Kuntur Pharma y Biomont Ecuador.
insert into public.site_responsibles (site_id, email, active)
select site.id, lower(person.email), true
from public.sites site
cross join public.organization_people person
where site.active
  and person.active
  and person.role = 'gerente_responsable'
  and person.email is not null
on conflict (site_id, email) do update
set active = true, updated_at = now();

create or replace function public.bulk_import_strategic_plan(import_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  row_number integer := 0;
  v_objective_id bigint;
  v_indicator_id bigint;
  owner text;
  objective_name text;
  indicator_name text;
  management_name text;
  focus_name text;
  target_value numeric;
  created_objectives integer := 0;
  created_indicators integer := 0;
  biomont_site_id bigint;
begin
  if not (public.is_gcg() or public.is_super_admin()) then
    raise exception 'Solo GCG puede realizar una carga masiva.';
  end if;

  if jsonb_typeof(import_rows) <> 'array' or jsonb_array_length(import_rows) = 0 then
    raise exception 'El archivo no contiene filas para importar.';
  end if;

  if jsonb_array_length(import_rows) > 500 then
    raise exception 'La carga masiva admite hasta 500 filas por archivo.';
  end if;

  select id into biomont_site_id
  from public.sites
  where active and lower(trim(name)) = 'biomont'
  limit 1;

  for item in select value from jsonb_array_elements(import_rows)
  loop
    row_number := row_number + 1;
    objective_name := nullif(trim(item->>'objective_name'), '');
    indicator_name := nullif(trim(item->>'indicator_name'), '');
    management_name := nullif(trim(item->>'responsible_management'), '');
    focus_name := nullif(trim(item->>'focus'), '');
    target_value := nullif(trim(item->>'target'), '')::numeric;

    if objective_name is null or indicator_name is null or management_name is null or focus_name is null or target_value is null then
      raise exception 'Fila %: faltan datos obligatorios (objetivo, foco, responsable, indicador o meta).', row_number;
    end if;
    if focus_name not in ('Financiero', 'Cliente', 'Procesos', 'Personas/Aprendizaje') then
      raise exception 'Fila %: el foco estratégico "%" no es válido.', row_number, focus_name;
    end if;

    select lower(email) into owner
    from public.organization_people
    where active
      and is_management_lead
      and email is not null
      and lower(trim(management)) = lower(management_name)
    order by full_name
    limit 1;

    if owner is null then
      raise exception 'Fila %: no existe una gerencia responsable para "%".', row_number, management_name;
    end if;

    select id into v_objective_id
    from public.objectives
    where lower(trim(name)) = lower(objective_name)
      and validity_start_year = 2025
      and validity_end_year = 2027
    order by id
    limit 1;

    if v_objective_id is null then
      insert into public.objectives (
        name, description, focus, owner_email, responsible_management,
        target_date, validity_start_year, validity_end_year, created_by
      ) values (
        objective_name, nullif(trim(item->>'description'), ''), focus_name, owner, management_name,
        date '2027-12-31', 2025, 2027, auth.uid()
      ) returning id into v_objective_id;
      created_objectives := created_objectives + 1;
    end if;

    select indicator.id into v_indicator_id
    from public.indicators indicator
    where indicator.objective_id = v_objective_id
      and lower(trim(indicator.name)) = lower(indicator_name)
    order by id
    limit 1;

    if v_indicator_id is null then
      insert into public.indicators (
        objective_id, name, formula, target, unit, comparator, frequency,
        review_frequency, owner_email, approval_status
      ) values (
        v_objective_id, indicator_name, nullif(trim(item->>'formula'), ''), target_value,
        coalesce(nullif(trim(item->>'unit'), ''), '%'), '>=', 'Mensual', 'Mensual', owner, 'Aprobado'
      ) returning id into v_indicator_id;
      created_indicators := created_indicators + 1;
    end if;

    if biomont_site_id is not null then
      insert into public.indicator_site_assignments (indicator_id, site_id, responsible_email, weight, active)
      values (v_indicator_id, biomont_site_id, owner, 1, true)
      on conflict (indicator_id, site_id) do nothing;
    end if;
  end loop;

  return jsonb_build_object(
    'created_objectives', created_objectives,
    'created_indicators', created_indicators,
    'processed_rows', row_number
  );
end;
$$;

revoke all on function public.bulk_import_strategic_plan(jsonb) from public, anon;
grant execute on function public.bulk_import_strategic_plan(jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
