-- Evita ambigüedad entre los parámetros de la función y las columnas de la tabla.
begin;

create or replace function public.set_indicator_annual_target(
  indicator bigint,
  target_year integer,
  target_value numeric,
  target_comparator text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_gcg() then
    raise exception 'Solo GCG puede definir metas anuales';
  end if;
  if $2 not between 2000 and 2100
    or $3 is null
    or $4 not in ('>', '>=', '=', '<=', '<') then
    raise exception 'Meta anual inválida';
  end if;
  if not exists (select 1 from public.indicators where id = $1) then
    raise exception 'Indicador no encontrado';
  end if;

  insert into public.indicator_annual_targets(indicator_id, target_year, target, comparator, created_by)
  values ($1, $2, $3, $4, auth.uid())
  on conflict (indicator_id, target_year) do update
  set target = excluded.target,
      comparator = excluded.comparator,
      updated_at = now();

  update public.indicator_reports r
  set measurement_target = $3,
      measurement_comparator = $4,
      status = case when r.result is null then 'Sin datos'
        else public.measurement_status(r.result, $3, $4) end,
      updated_at = now()
  where r.indicator_id = $1
    and extract(year from public.indicator_period_date(r.period)) = $2;
end;
$$;

revoke all on function public.set_indicator_annual_target(bigint, integer, numeric, text) from public, anon;
grant execute on function public.set_indicator_annual_target(bigint, integer, numeric, text) to authenticated;
notify pgrst, 'reload schema';
commit;
