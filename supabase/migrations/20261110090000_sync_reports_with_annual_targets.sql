-- Alinea las mediciones existentes con las metas anuales ya definidas.
-- Cada reporte queda evaluado con la meta de su propio año.
begin;

update public.indicator_reports r
set measurement_target = annual.target,
    measurement_comparator = annual.comparator,
    status = case when r.result is null then 'Sin datos'
      else public.measurement_status(r.result, annual.target, annual.comparator) end,
    updated_at = now()
from public.indicator_annual_targets annual
where annual.indicator_id = r.indicator_id
  and annual.target_year = extract(year from public.indicator_period_date(r.period));

notify pgrst, 'reload schema';
commit;
