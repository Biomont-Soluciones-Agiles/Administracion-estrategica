-- Las metas anuales pertenecen a una sede. Las metas previas sin sede se
-- conservan como respaldo para no perder el historial existente.
begin;

alter table public.indicator_annual_targets
  add column if not exists site_id bigint references public.sites(id) on delete cascade;

alter table public.indicator_annual_targets
  drop constraint if exists indicator_annual_targets_indicator_id_target_year_key;

drop index if exists public.indicator_annual_targets_global_unique;
drop index if exists public.indicator_annual_targets_site_unique;
create unique index indicator_annual_targets_global_unique
  on public.indicator_annual_targets(indicator_id, target_year)
  where site_id is null;
create unique index indicator_annual_targets_site_unique
  on public.indicator_annual_targets(indicator_id, site_id, target_year)
  where site_id is not null;

create index if not exists indicator_annual_targets_site_lookup_idx
  on public.indicator_annual_targets(indicator_id, site_id, target_year);

drop function if exists public.indicator_target_for_year(bigint, integer);
create function public.indicator_target_for_year(
  indicator bigint,
  target_year integer,
  target_site_id bigint default null
)
returns table(target numeric, comparator text)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(annual.target, i.target), coalesce(annual.comparator, i.comparator)
  from public.indicators i
  left join lateral (
    select annual_target.target, annual_target.comparator
    from public.indicator_annual_targets annual_target
    where annual_target.indicator_id = i.id
      and annual_target.target_year = $2
      and (annual_target.site_id = $3 or annual_target.site_id is null)
    order by case when annual_target.site_id = $3 then 0 else 1 end
    limit 1
  ) annual on true
  where i.id = $1;
$$;

drop function if exists public.set_indicator_annual_target(bigint, integer, numeric, text);
create function public.set_indicator_annual_target(
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
  if target_site_id is null or not exists (select 1 from public.sites where id = target_site_id and active) then
    raise exception 'Selecciona una sede activa para definir su meta anual';
  end if;
  if not exists (select 1 from public.indicators where id = indicator) then
    raise exception 'Indicador no encontrado';
  end if;

  update public.indicator_annual_targets
  set target = target_value,
      comparator = target_comparator,
      updated_at = now()
  where indicator_id = set_indicator_annual_target.indicator
    and target_year = set_indicator_annual_target.target_year
    and site_id = target_site_id;

  if not found then
    insert into public.indicator_annual_targets(indicator_id, site_id, target_year, target, comparator, created_by)
    values (indicator, target_site_id, target_year, target_value, target_comparator, auth.uid());
  end if;

  update public.indicator_reports report
  set measurement_target = target_value,
      measurement_comparator = target_comparator,
      status = case when report.result is null then 'Sin datos'
        else public.measurement_status(report.result, target_value, target_comparator) end,
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
  measurement_site_id bigint;
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

  select site_id into measurement_site_id
  from public.indicator_site_assignments
  where id = new.site_assignment_id;
  period_year := extract(year from public.indicator_period_date(new.period));
  select target, comparator into annual_target, annual_comparator
  from public.indicator_annual_targets
  where indicator_id = i.id
    and target_year = period_year
    and (site_id = measurement_site_id or site_id is null)
  order by case when site_id = measurement_site_id then 0 else 1 end
  limit 1;

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

revoke all on function public.set_indicator_annual_target(bigint, integer, numeric, text, bigint) from public, anon;
grant execute on function public.set_indicator_annual_target(bigint, integer, numeric, text, bigint) to authenticated;

notify pgrst, 'reload schema';
commit;
