-- Las listas de indicadores GCG y GG no tienen un máximo de selección.
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
  if requested_count <> coalesce(cardinality(array(select distinct unnest(selected_indicator_ids))), 0) then
    raise exception 'No se puede repetir un indicador GCG.';
  end if;

  select count(*) into valid_count from public.indicators where id = any(selected_indicator_ids);
  if valid_count <> requested_count then
    raise exception 'Uno o más indicadores seleccionados no existen.';
  end if;

  delete from public.core_indicators;
  insert into public.core_indicators (indicator_id, position)
  select indicator_id, position
  from unnest(selected_indicator_ids) with ordinality as selected(indicator_id, position)
  order by position;
end;
$$;

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
  if requested_count <> coalesce(cardinality(array(select distinct unnest(selected_indicator_ids))), 0) then
    raise exception 'No se puede repetir un indicador GG.';
  end if;

  select count(*) into valid_count from public.indicators where id = any(selected_indicator_ids);
  if valid_count <> requested_count then
    raise exception 'Uno o más indicadores seleccionados no existen.';
  end if;

  delete from public.general_manager_indicators;
  insert into public.general_manager_indicators (indicator_id, position)
  select indicator_id, position
  from unnest(selected_indicator_ids) with ordinality as selected(indicator_id, position)
  order by position;
end;
$$;

grant execute on function public.set_core_indicators(bigint[]) to authenticated;
grant execute on function public.set_general_manager_indicators(bigint[]) to authenticated;
notify pgrst, 'reload schema';
