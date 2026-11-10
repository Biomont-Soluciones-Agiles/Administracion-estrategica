-- Permite actualizar de forma explícita la meta histórica cuando GCG define
-- una meta anual, sin perder la protección habitual de cada medición.
begin;

create or replace function public.prepare_measurement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  i public.indicators;
  annual_target numeric;
  annual_comparator text;
  period_year integer;
begin
  select * into strict i from public.indicators where id = new.indicator_id for update;
  if tg_op = 'INSERT' and exists (
    select 1 from public.indicator_reports r
    where r.indicator_id = new.indicator_id
      and coalesce(r.site_assignment_id, 0) = coalesce(new.site_assignment_id, 0)
      and public.indicator_period_date(r.period) = public.indicator_period_date(new.period)
  ) then
    raise exception 'Este periodo ya fue registrado para esta sede.';
  end if;

  period_year := extract(year from public.indicator_period_date(new.period));
  select target, comparator into annual_target, annual_comparator
  from public.indicator_annual_targets
  where indicator_id = i.id and target_year = period_year;

  if tg_op = 'INSERT' then
    new.measurement_target = coalesce(annual_target, i.target);
    new.measurement_comparator = coalesce(annual_comparator, i.comparator);
  else
    new.measurement_target = coalesce(
      case when new.measurement_target is not null
             and new.measurement_target is distinct from old.measurement_target
           then new.measurement_target end,
      old.measurement_target,
      annual_target,
      i.target
    );
    new.measurement_comparator = coalesce(
      case when new.measurement_comparator is not null
             and new.measurement_comparator is distinct from old.measurement_comparator
           then new.measurement_comparator end,
      old.measurement_comparator,
      annual_comparator,
      i.comparator
    );
  end if;
  new.status = case when new.result is null then 'Sin datos'
    else public.measurement_status(new.result, new.measurement_target, new.measurement_comparator) end;
  return new;
end;
$$;

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
