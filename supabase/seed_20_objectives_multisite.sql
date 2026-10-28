-- Portafolio demostrativo multisedes.
-- Ejecutar UNA sola vez en Supabase SQL Editor, después de limpiar datos operativos.
-- No modifica usuarios, roles, directorio, sedes ni integraciones PMO.

begin;

do $$
declare
  biomont_site_id bigint;
  kunthur_site_id bigint;
  item record;
  objective_id bigint;
  indicator_id bigint;
  biomont_assignment_id bigint;
  kunthur_assignment_id bigint;
  report_month date;
  period_label text;
  biomont_result numeric;
  kunthur_result numeric;
  report_counter integer := 0;
begin
  if exists (select 1 from public.objectives) or exists (select 1 from public.indicators) then
    raise exception 'La carga requiere objetivos e indicadores vacíos.';
  end if;

  -- La limpieza operativa puede haber eliminado las sedes. Se recuperan sin
  -- alterar las configuraciones existentes cuando ya están creadas.
  insert into public.sites (name, active) values
    ('Biomont', true),
    ('Kuntur', true),
    ('Biomont Ecuador', true)
  on conflict (name) do update set active = true;

  select id into biomont_site_id from public.sites where lower(name) = 'biomont' limit 1;
  select id into kunthur_site_id from public.sites where lower(name) in ('kunthur', 'kuntur') limit 1;
  if biomont_site_id is null or kunthur_site_id is null then
    raise exception 'No se pudieron preparar las sedes Biomont y Kunthur.';
  end if;

  create temporary table seed_objectives (
    seq integer primary key,
    name text not null,
    description text not null,
    category text not null,
    management text not null,
    owner_email text not null,
    indicator_scope text not null check (indicator_scope in ('biomont', 'dual', 'none'))
  ) on commit drop;

  insert into seed_objectives values
    (1,'Optimizar la rentabilidad financiera','Mejorar el margen y la eficiencia del gasto para sostener el crecimiento.','Financiero','Administración y Finanzas','jamaro@biomont.com.pe','dual'),
    (2,'Incrementar ingresos de canales comerciales','Impulsar los ingresos rentables de los canales prioritarios.','Financiero','Central Comercial','cmedrano@biomont.com.pe','dual'),
    (3,'Digitalizar el control presupuestal','Asegurar información oportuna para decisiones financieras.','Financiero','Tecnologías de la Información','chuerta@biomont.com.pe','biomont'),
    (4,'Reducir el costo logístico integral','Optimizar abastecimiento, inventarios y distribución.','Financiero','Supply Chain','jdelavega@biomont.com.pe','biomont'),
    (5,'Mejorar la productividad de planta','Elevar la productividad de las operaciones y capacidad instalada.','Financiero','Operaciones y Planta','wpena@biomont.com.pe','biomont'),
    (6,'Elevar la satisfacción de clientes estratégicos','Fortalecer la propuesta de valor y experiencia de clientes.','Cliente','Central Comercial','cmedrano@biomont.com.pe','dual'),
    (7,'Fortalecer la fidelización de clientes','Aumentar la permanencia y recompra de clientes prioritarios.','Cliente','Central Comercial','rbaca@biomont.com.pe','biomont'),
    (8,'Mejorar la oportunidad de facturación','Garantizar facturación precisa dentro del plazo comprometido.','Cliente','Administración y Finanzas','jamaro@biomont.com.pe','biomont'),
    (9,'Desarrollar capacidades de servicio','Potenciar competencias orientadas a la atención del cliente.','Cliente','Gestión Humana','nmas@biomont.com.pe','biomont'),
    (10,'Asegurar disponibilidad de productos','Mantener niveles de servicio que respondan a la demanda comercial.','Cliente','Supply Chain','jdelavega@biomont.com.pe','biomont'),
    (11,'Optimizar procesos productivos críticos','Reducir pérdidas y variabilidad en los procesos de planta.','Procesos','Operaciones y Planta','wpena@biomont.com.pe','biomont'),
    (12,'Automatizar procesos administrativos','Simplificar procesos mediante soluciones tecnológicas confiables.','Procesos','Tecnologías de la Información','chuerta@biomont.com.pe','biomont'),
    (13,'Fortalecer el cumplimiento regulatorio','Asegurar requisitos regulatorios aplicables.','Procesos','Asuntos Regulatorios','hsalazar@biomont.com.pe','biomont'),
    (14,'Mejorar la planificación de abastecimiento','Anticipar necesidades y reducir quiebres de inventario.','Procesos','Supply Chain','jdelavega@biomont.com.pe','biomont'),
    (15,'Acelerar la respuesta a requerimientos','Mejorar tiempo de respuesta a solicitudes comerciales.','Procesos','Central Comercial','cmedrano@biomont.com.pe','dual'),
    (16,'Fortalecer el compromiso del talento','Incrementar compromiso y permanencia del equipo.','Personas / Aprendizaje','Gestión Humana','nmas@biomont.com.pe','biomont'),
    (17,'Desarrollar capacidades técnico científicas','Consolidar conocimientos técnicos para innovación y calidad.','Personas / Aprendizaje','Técnica Científica','ireyna@biomont.com.pe','biomont'),
    (18,'Mejorar competencias operativas','Desarrollar capacidades para una operación segura y eficiente.','Personas / Aprendizaje','Operaciones y Planta','wpena@biomont.com.pe','biomont'),
    (19,'Consolidar la excelencia comercial','Implementar iniciativas de mejora continua para la gestión comercial.','Personas / Aprendizaje','Central Comercial','cmedrano@biomont.com.pe','none'),
    (20,'Fortalecer la disciplina financiera','Promover prácticas de control y sostenibilidad financiera.','Personas / Aprendizaje','Administración y Finanzas','jamaro@biomont.com.pe','none');

  for item in select * from seed_objectives order by seq loop
    insert into public.objectives (name,description,category,focus,owner_email,responsible_management,progress,status,created_date,target_date,stakeholders)
    values (item.name,item.description,item.category,case when item.category = 'Personas / Aprendizaje' then 'Personas/Aprendizaje' else item.category end,item.owner_email,item.management,0,'En progreso',current_date,date '2027-12-31','[]'::jsonb)
    returning id into objective_id;

    insert into public.projects (objective_id,name,status,progress,owner_email,source)
    values (objective_id,'Proyecto estratégico: ' || item.name,'En progreso',35 + ((item.seq * 7) % 55),item.owner_email,'Plan estratégico');

    insert into public.strategic_actions (objective_id,name,description,status,due_date)
    values (objective_id,'Acción estratégica: ' || item.name,'Ejecutar el plan de trabajo trimestral asociado al objetivo.','En progreso',date '2027-06-30');

    if item.indicator_scope <> 'none' then
      insert into public.indicators (objective_id,name,resource,formula,target,unit,comparator,frequency,owner_email,status,approval_status)
      values (objective_id,'Avance de ' || lower(item.name),'Gestión estratégica','Resultado alcanzado / meta programada × 100',90,'%','>=','Mensual',item.owner_email,'Sin reporte','Aprobado')
      returning id into indicator_id;

      insert into public.indicator_site_assignments (indicator_id,site_id,responsible_email,weight,active)
      values (indicator_id,biomont_site_id,item.owner_email,1,true)
      returning id into biomont_assignment_id;

      kunthur_assignment_id := null;
      if item.indicator_scope = 'dual' then
        insert into public.indicator_site_assignments (indicator_id,site_id,responsible_email,weight,active)
        values (indicator_id,kunthur_site_id,case when item.management='Central Comercial' then 'jcardenas@kunturpharma.pe' else 'jamaro@biomont.com.pe' end,1,true)
        returning id into kunthur_assignment_id;
      end if;

      for report_month in select generate_series(date '2024-01-01',date '2026-08-01',interval '1 month')::date loop
        report_counter := report_counter + 1;
        period_label := case extract(month from report_month)::integer
          when 1 then 'Enero' when 2 then 'Febrero' when 3 then 'Marzo' when 4 then 'Abril'
          when 5 then 'Mayo' when 6 then 'Junio' when 7 then 'Julio' when 8 then 'Agosto'
          when 9 then 'Septiembre' when 10 then 'Octubre' when 11 then 'Noviembre' else 'Diciembre'
        end || ' ' || extract(year from report_month)::integer;
        biomont_result := (case report_counter % 4 when 0 then 72 when 1 then 90 when 2 then 103 else 116 end) + ((item.seq % 3) * 0.5);

        insert into public.indicator_reports (indicator_id,site_assignment_id,period,result,status,registered_date,observations)
        values (indicator_id,biomont_assignment_id,period_label,biomont_result,'En meta',report_month,'Medición histórica Biomont generada para la demostración.');

        if kunthur_assignment_id is not null then
          kunthur_result := (case report_counter % 4 when 0 then 68 when 1 then 88 when 2 then 98 else 110 end) + ((item.seq % 2) * 0.5);
          insert into public.indicator_reports (indicator_id,site_assignment_id,period,result,status,registered_date,observations)
          values (indicator_id,kunthur_assignment_id,period_label,kunthur_result,'En meta',report_month,'Medición histórica Kunthur generada para la demostración.');
        end if;
      end loop;
    end if;
  end loop;
end $$;

commit;
