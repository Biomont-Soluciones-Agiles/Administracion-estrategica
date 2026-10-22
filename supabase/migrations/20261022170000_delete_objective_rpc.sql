-- Permite al GCG eliminar un objetivo y todos sus datos operativos relacionados.
begin;

create or replace function public.delete_objective(objective bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_gcg() then
    raise exception 'Solo GCG puede eliminar objetivos';
  end if;

  if not exists (select 1 from public.objectives where id = objective) then
    raise exception 'El objetivo ya no existe';
  end if;

  -- Se eliminan primero los elementos que no tienen borrado en cascada.
  delete from public.corrective_evidence
  where task_id in (
    select task.id
    from public.corrective_tasks task
    join public.corrective_actions action on action.id = task.action_id
    join public.cause_analyses analysis on analysis.id = action.analysis_id
    join public.indicator_reports report on report.id = analysis.report_id
    join public.indicators indicator on indicator.id = report.indicator_id
    where indicator.objective_id = objective
  );

  delete from public.corrective_events
  where analysis_id in (
    select analysis.id
    from public.cause_analyses analysis
    join public.indicator_reports report on report.id = analysis.report_id
    join public.indicators indicator on indicator.id = report.indicator_id
    where indicator.objective_id = objective
  );

  delete from public.corrective_tasks
  where action_id in (
    select action.id
    from public.corrective_actions action
    join public.cause_analyses analysis on analysis.id = action.analysis_id
    join public.indicator_reports report on report.id = analysis.report_id
    join public.indicators indicator on indicator.id = report.indicator_id
    where indicator.objective_id = objective
  );

  delete from public.corrective_actions
  where analysis_id in (
    select analysis.id
    from public.cause_analyses analysis
    join public.indicator_reports report on report.id = analysis.report_id
    join public.indicators indicator on indicator.id = report.indicator_id
    where indicator.objective_id = objective
  );

  delete from public.cause_analyses
  where report_id in (
    select report.id
    from public.indicator_reports report
    join public.indicators indicator on indicator.id = report.indicator_id
    where indicator.objective_id = objective
  );

  delete from public.indicator_change_requests
  where indicator_id in (
    select id from public.indicators where objective_id = objective
  );

  delete from public.objectives where id = objective;
end;
$$;

revoke all on function public.delete_objective(bigint) from public, anon;
grant execute on function public.delete_objective(bigint) to authenticated;
notify pgrst, 'reload schema';

commit;
