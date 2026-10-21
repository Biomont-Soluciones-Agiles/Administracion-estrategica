-- Crea y corrige la persistencia de Indicadores Core.
-- La tabla guarda una fila por indicador, no un arreglo indicator_ids.

create table if not exists public.core_indicators (
  indicator_id bigint primary key references public.indicators(id) on delete cascade,
  created_at timestamptz not null default now()
);

grant select on table public.core_indicators to authenticated;

create or replace function public.set_core_indicators(selected_indicator_ids bigint[])
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
    raise exception 'Solo se pueden seleccionar hasta cuatro indicadores Core.';
  end if;

  if requested_count <> coalesce(cardinality(array(select distinct unnest(selected_indicator_ids))), 0) then
    raise exception 'No se puede repetir un indicador Core.';
  end if;

  select count(*)
    into valid_count
  from public.indicators
  where id = any(selected_indicator_ids);

  if valid_count <> requested_count then
    raise exception 'Uno o más indicadores seleccionados no existen.';
  end if;

  delete from public.core_indicators;

  insert into public.core_indicators (indicator_id)
  select indicator_id
  from unnest(selected_indicator_ids) with ordinality as selected(indicator_id, position)
  order by position;
end;
$$;

grant execute on function public.set_core_indicators(bigint[]) to authenticated;
