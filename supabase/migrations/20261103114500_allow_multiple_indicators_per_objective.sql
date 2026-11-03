-- Un objetivo puede tener múltiples indicadores. Sus ponderaciones se reparten
-- automáticamente en partes iguales cuando se agrega o elimina uno.
begin;

alter table public.indicators
  add column if not exists objective_weight numeric not null default 100
  check (objective_weight > 0 and objective_weight <= 100);

update public.indicators
set objective_weight = 100
where objective_weight is null or objective_weight <= 0;

drop trigger if exists enforce_one_indicator_per_objective on public.indicators;
drop function if exists public.enforce_one_indicator_per_objective();

create or replace function public.rebalance_objective_indicator_weights()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_objective bigint := coalesce(new.objective_id, old.objective_id);
  indicator_count integer;
begin
  select count(*) into indicator_count
  from public.indicators
  where objective_id = target_objective;

  if indicator_count > 0 then
    update public.indicators
    set objective_weight = 100::numeric / indicator_count
    where objective_id = target_objective;
  end if;

  return null;
end;
$$;

drop trigger if exists rebalance_objective_indicator_weights on public.indicators;
create trigger rebalance_objective_indicator_weights
after insert or delete on public.indicators
for each row execute function public.rebalance_objective_indicator_weights();

notify pgrst, 'reload schema';
commit;
