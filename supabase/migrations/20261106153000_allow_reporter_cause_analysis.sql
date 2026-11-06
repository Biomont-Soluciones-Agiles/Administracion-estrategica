-- Permite que quien registró una medición fuera de meta inicie y gestione su propio análisis.
-- El gerente responsable conserva la gestión de todos los análisis de sus indicadores.
begin;

create or replace function public.can_manage_measurement_analysis(measurement bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.indicator_reports r
    where r.id = measurement
      and (
        public.can_manage_reporting(r.indicator_id)
        or r.created_by = auth.uid()
      )
  );
$$;

create or replace function public.can_read_analysis(analysis bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.cause_analyses c
    join public.indicator_reports r on r.id = c.report_id
    where c.id = analysis
      and public.can_manage_measurement_analysis(r.id)
  );
$$;

create or replace function public.can_edit_analysis(analysis bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.cause_analyses c
    join public.indicator_reports r on r.id = c.report_id
    where c.id = analysis
      and c.status = 'En proceso'
      and c.approved_at is null
      and (
        public.can_manage_reporting(r.indicator_id)
        or (r.created_by = auth.uid() and c.created_by = auth.uid())
      )
  );
$$;

create or replace function public.save_five_whys(measurement bigint, answers jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.indicator_reports;
  c public.cause_analyses;
  answer_count integer;
  result_id bigint;
begin
  select * into strict r from public.indicator_reports where id = measurement for update;
  if auth.uid() is null or not public.can_manage_measurement_analysis(r.id) then
    raise exception 'Solo quien registró la medición o el gerente responsable puede registrar los 5 porqués';
  end if;
  if r.status <> 'Fuera de meta' then
    raise exception 'Los 5 porqués requieren una medición fuera de meta';
  end if;
  if jsonb_typeof(answers) <> 'array' then
    raise exception 'Las respuestas de los 5 porqués no son válidas';
  end if;
  select count(*) into answer_count from jsonb_array_elements_text(answers) answer where length(trim(answer)) > 0;
  if jsonb_array_length(answers) <> 5 or answer_count <> 5 then
    raise exception 'Completa las cinco respuestas antes de guardar';
  end if;
  select * into c from public.cause_analyses where report_id = r.id for update;
  if found then
    if not public.can_edit_analysis(c.id)
       or exists (
         select 1 from public.corrective_tasks t
         join public.corrective_actions a on a.id = t.action_id
         where a.analysis_id = c.id and t.review_status in ('En revisión', 'Aprobado')
       ) then
      raise exception 'El análisis ya fue enviado a revisión';
    end if;
    update public.cause_analyses
      set five_whys = answers, cause = trim(answers ->> 4), updated_at = now()
      where id = c.id returning id into result_id;
  else
    insert into public.cause_analyses (
      report_id, cause, deviation_description, complementary_data, five_whys, created_by
    ) values (
      r.id, trim(answers ->> 4),
      coalesce(nullif(trim(r.observations), ''), 'El resultado del periodo ' || r.period || ' se encuentra fuera de meta.'),
      '', answers, auth.uid()
    ) returning id into result_id;
  end if;
  insert into public.corrective_events (analysis_id, event, note, actor)
  values (result_id, '5 porqués guardados', trim(answers ->> 4), auth.uid());
  return result_id;
end;
$$;

create or replace function public.save_cause_analysis_details(
  measurement bigint, cause_text text, deviation_text text, complementary_text text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.indicator_reports;
  c public.cause_analyses;
  result_id bigint;
begin
  select * into strict r from public.indicator_reports where id = measurement for update;
  if auth.uid() is null or not public.can_manage_measurement_analysis(r.id) then
    raise exception 'Solo quien registró la medición o el gerente responsable puede registrar el análisis';
  end if;
  if r.status <> 'Fuera de meta' then
    raise exception 'El análisis requiere una medición fuera de meta';
  end if;
  if coalesce(length(trim(cause_text)), 0) = 0 then
    raise exception 'Describe el análisis de causa';
  end if;
  if coalesce(length(trim(deviation_text)), 0) = 0 then
    raise exception 'Describe la desviación';
  end if;
  select * into c from public.cause_analyses where report_id = r.id for update;
  if found then
    if not public.can_edit_analysis(c.id)
       or exists (
         select 1 from public.corrective_tasks t
         join public.corrective_actions a on a.id = t.action_id
         where a.analysis_id = c.id and t.review_status in ('En revisión', 'Aprobado')
       ) then
      raise exception 'El análisis ya fue enviado a revisión';
    end if;
    update public.cause_analyses
      set cause = trim(cause_text),
          deviation_description = trim(deviation_text),
          complementary_data = coalesce(trim(complementary_text), ''),
          updated_at = now()
      where id = c.id returning id into result_id;
  else
    insert into public.cause_analyses (
      report_id, cause, deviation_description, complementary_data, created_by
    ) values (
      r.id, trim(cause_text), trim(deviation_text), coalesce(trim(complementary_text), ''), auth.uid()
    ) returning id into result_id;
  end if;
  insert into public.corrective_events (analysis_id, event, note, actor)
  values (result_id, 'Análisis guardado', trim(cause_text), auth.uid());
  return result_id;
end;
$$;

revoke all on function public.can_manage_measurement_analysis(bigint) from public, anon, authenticated;
grant execute on function public.can_manage_measurement_analysis(bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
