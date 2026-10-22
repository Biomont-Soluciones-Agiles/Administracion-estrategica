-- Indicadores asignados para la vista de Gerencia General.

create table if not exists public.general_manager_indicators (
  indicator_id bigint primary key references public.indicators(id) on delete cascade,
  position integer,
  created_at timestamptz not null default now()
);

grant select on table public.general_manager_indicators to authenticated;

alter table public.general_manager_indicators enable row level security;
drop policy if exists "authenticated users can read general manager indicators" on public.general_manager_indicators;
create policy "authenticated users can read general manager indicators"
  on public.general_manager_indicators for select to authenticated using (true);

create or replace function public.set_general_manager_indicators(selected_indicator_ids bigint[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_count integer := coalesce(cardinality(selected_indicator_ids), 0);
  valid_count integer;
begin
  if requested_count > 4 then
    raise exception 'Solo se pueden seleccionar hasta cuatro indicadores para Gerencia General.';
  end if;

  if requested_count <> coalesce(cardinality(array(select distinct unnest(selected_indicator_ids))), 0) then
    raise exception 'No se puede repetir un indicador.';
  end if;

  select count(*) into valid_count
  from public.indicators
  where id = any(selected_indicator_ids);

  if valid_count <> requested_count then
    raise exception 'Uno o más indicadores seleccionados no existen.';
  end if;

  delete from public.general_manager_indicators
  where indicator_id is not null;

  insert into public.general_manager_indicators (indicator_id, position)
  select indicator_id, position
  from unnest(selected_indicator_ids) with ordinality as selected(indicator_id, position)
  order by position;
end;
$$;

grant execute on function public.set_general_manager_indicators(bigint[]) to authenticated;

-- Asigna el perfil de solo lectura a Aldo Pedraglio de Cossio si ya figura
-- en el directorio organizacional. No se crea una cuenta ni se inventa un correo.
do $$
declare
  aldo_email text;
begin
  select lower(trim(email))
    into aldo_email
  from public.organization_people
  where active = true
    and lower(full_name) like '%aldo%'
    and lower(full_name) like '%pedraglio%'
  order by full_name
  limit 1;

  if aldo_email is null then
    raise notice 'No se encontró a Aldo Pedraglio de Cossio en organization_people. Asigna el rol cuando su cuenta esté registrada.';
  else
    insert into public.role_assignments (email, role)
    values (aldo_email, 'gerente_general')
    on conflict (email) do update set role = excluded.role;
  end if;
end;
$$;

notify pgrst, 'reload schema';
