-- Evita ambigüedad entre los parámetros de la función y las columnas de la tabla.
begin;

create or replace function public.set_indicator_annual_target(
  indicator bigint,
  target_year integer,
  target_value numeric,
  target_comparator text,
  target_site_id bigint default null
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
  if target_year not between 2000 and 2100
    or target_value is null
    or target_comparator not in ('>', '>=', '=', '<=', '<') then
    raise exception 'Meta anual inválida';
  end if;
  if target_site_id is null or not exists (select 1 from public.sites site where site.id = target_site_id and site.active) then
    raise exception 'Selecciona una sede activa para definir su meta anual';
  end if;
  if not exists (select 1 from public.indicators item where item.id = indicator) then
    raise exception 'Indicador no encontrado';
  end if;

  update public.indicator_annual_targets annual_target
  set target = target_value,
      comparator = target_comparator,
      updated_at = now()
  where annual_target.indicator_id = set_indicator_annual_target.indicator
    and annual_target.target_year = set_indicator_annual_target.target_year
    and annual_target.site_id = set_indicator_annual_target.target_site_id;

  if not found then
    insert into public.indicator_annual_targets(indicator_id, site_id, target_year, target, comparator, created_by)
    values (
      set_indicator_annual_target.indicator,
      set_indicator_annual_target.target_site_id,
      set_indicator_annual_target.target_year,
      set_indicator_annual_target.target_value,
      set_indicator_annual_target.target_comparator,
      auth.uid()
    );
  end if;

  update public.indicator_reports report
  set measurement_target = set_indicator_annual_target.target_value,
      measurement_comparator = set_indicator_annual_target.target_comparator,
      status = case when report.result is null then 'Sin datos'
        else public.measurement_status(report.result, set_indicator_annual_target.target_value, set_indicator_annual_target.target_comparator) end,
      updated_at = now()
  where report.indicator_id = set_indicator_annual_target.indicator
    and extract(year from public.indicator_period_date(report.period)) = set_indicator_annual_target.target_year
    and report.site_assignment_id in (
      select assignment.id
      from public.indicator_site_assignments assignment
      where assignment.indicator_id = set_indicator_annual_target.indicator
        and assignment.site_id = set_indicator_annual_target.target_site_id
    );
end;
$$;

notify pgrst, 'reload schema';
commit;
