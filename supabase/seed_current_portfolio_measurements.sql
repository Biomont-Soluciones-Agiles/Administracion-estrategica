-- Carga controlada para el portafolio actual (12 objetivos y 12 indicadores).
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- No borra información: completa responsables y agrega solo periodos que aún no existen.
--
-- Genera una medición mensual por indicador desde enero de 2025 hasta junio de 2026
-- (18 periodos; máximo 216 mediciones). Las condiciones se derivan automáticamente
-- del resultado y la meta: Pesimista, Optimista y Excepcional.

begin;

do $$
declare
  v_objective_count integer;
  v_indicator_count integer;
  v_person_email text;
  v_biomont_site_id bigint;
  v_indicator record;
  v_assignment_id bigint;
  v_period date;
  v_period_label text;
  v_condition_index integer;
  v_result numeric;
  v_inserted integer := 0;
  v_skipped integer := 0;
begin
  select count(*) into v_objective_count from public.objectives;
  select count(*) into v_indicator_count from public.indicators;

  if v_objective_count <> 12 or v_indicator_count <> 12 then
    raise exception
      'Carga detenida: se esperaban exactamente 12 objetivos y 12 indicadores; se encontraron % y %.',
      v_objective_count, v_indicator_count;
  end if;

  if not exists (
    select 1
    from public.organization_people
    where active = true and nullif(trim(email), '') is not null
  ) then
    raise exception 'Carga detenida: no hay personas activas con correo para asignar responsables.';
  end if;

  select id into v_biomont_site_id
  from public.sites
  where lower(trim(name)) = 'biomont' and active = true
  limit 1;

  if v_biomont_site_id is null then
    raise exception 'Carga detenida: no se encontró la sede Biomont activa.';
  end if;

  -- Un responsable aleatorio para cada objetivo actual.
  for v_indicator in select id from public.objectives order by id loop
    select email into v_person_email
    from public.organization_people
    where active = true and nullif(trim(email), '') is not null
    order by case when role = 'gerente_responsable' then 0 else 1 end, random()
    limit 1;

    update public.objectives
    set owner_email = lower(trim(v_person_email)), updated_at = now()
    where id = v_indicator.id;
  end loop;

  -- Un responsable aleatorio para cada indicador y sus asignaciones de sede.
  for v_indicator in select id from public.indicators order by id loop
    select email into v_person_email
    from public.organization_people
    where active = true and nullif(trim(email), '') is not null
    order by case when role = 'gerente_responsable' then 0 else 1 end, random()
    limit 1;

    update public.indicators
    set owner_email = lower(trim(v_person_email)), updated_at = now()
    where id = v_indicator.id;

    -- Garantiza una asignación activa en Biomont para poder registrar la serie.
    if not exists (
      select 1 from public.indicator_site_assignments
      where indicator_id = v_indicator.id and site_id = v_biomont_site_id and active = true
    ) then
      insert into public.indicator_site_assignments (
        indicator_id, site_id, responsible_email, weight, active
      )
      values (v_indicator.id, v_biomont_site_id, lower(trim(v_person_email)), 1, true);
    end if;

    -- Reasigna al azar los responsables de todas las sedes ya vinculadas al indicador.
    update public.indicator_site_assignments assignment_row
    set responsible_email = (
          select lower(trim(person.email))
          from public.organization_people person
          where person.active = true and nullif(trim(person.email), '') is not null
          order by case when person.role = 'gerente_responsable' then 0 else 1 end, random()
          limit 1
        ),
        updated_at = now()
    where assignment_row.indicator_id = v_indicator.id
      and assignment_row.active = true;
  end loop;

  -- Serie mensual para cada indicador: enero 2025 a junio 2026.
  for v_indicator in
    select id, target, comparator
    from public.indicators
    order by id
  loop
    select assignment_row.id into v_assignment_id
    from public.indicator_site_assignments assignment_row
    join public.sites site on site.id = assignment_row.site_id
    where assignment_row.indicator_id = v_indicator.id
      and assignment_row.active = true
    order by case when lower(trim(site.name)) = 'biomont' then 0 else 1 end, assignment_row.id
    limit 1;

    for v_period in
      select month_start::date
      from generate_series(date '2025-01-01', date '2026-06-01', interval '1 month') as month_start
    loop
      -- Rota condiciones por periodo e indicador: 0 Pesimista, 1 Optimista, 2 Excepcional.
      v_condition_index := mod(
        v_indicator.id + extract(year from v_period)::integer + extract(month from v_period)::integer,
        3
      );

      v_period_label := case extract(month from v_period)::integer
        when 1 then 'Enero'
        when 2 then 'Febrero'
        when 3 then 'Marzo'
        when 4 then 'Abril'
        when 5 then 'Mayo'
        when 6 then 'Junio'
        when 7 then 'Julio'
        when 8 then 'Agosto'
        when 9 then 'Septiembre'
        when 10 then 'Octubre'
        when 11 then 'Noviembre'
        else 'Diciembre'
      end || ' ' || extract(year from v_period)::integer;

      -- Los resultados se calculan en función del comparador para producir
      -- estados En meta / Fuera de meta y las tres condiciones visuales.
      v_result := case
        when v_condition_index = 0 and v_indicator.comparator in ('<=', '<') then v_indicator.target * 1.30
        when v_condition_index = 0 then v_indicator.target * 0.70
        when v_condition_index = 1 then v_indicator.target
        when v_condition_index = 2 and v_indicator.comparator in ('<=', '<') then v_indicator.target * 0.85
        else v_indicator.target * 1.15
      end;

      if exists (
        select 1
        from public.indicator_reports report
        where report.indicator_id = v_indicator.id
          and public.indicator_period_date(report.period) = v_period
      ) then
        v_skipped := v_skipped + 1;
      else
        insert into public.indicator_reports (
          indicator_id,
          site_assignment_id,
          period,
          result,
          status,
          registered_date,
          observations
        )
        values (
          v_indicator.id,
          v_assignment_id,
          v_period_label,
          round(v_result, 2),
          'Sin datos',
          (v_period + interval '1 month - 1 day')::date,
          'Carga de prueba: ' || case v_condition_index
            when 0 then 'condición pesimista'
            when 1 then 'condición optimista'
            else 'condición excepcional'
          end
        );
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end loop;

  raise notice 'Carga completada: % mediciones nuevas y % periodos preexistentes omitidos.', v_inserted, v_skipped;
end $$;

commit;

-- Verificación final.
select
  (select count(*) from public.objectives) as objetivos,
  (select count(*) from public.indicators) as indicadores,
  (select count(*) from public.indicator_reports) as mediciones_totales,
  (select count(*) from public.indicator_reports where status = 'En meta') as en_meta,
  (select count(*) from public.indicator_reports where status = 'Fuera de meta') as fuera_de_meta;
