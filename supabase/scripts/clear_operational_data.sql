-- Limpieza operativa de BIOMET
-- Ejecutar manualmente en Supabase > SQL Editor.
-- Conserva: perfiles, roles, directorio, sedes, gerencias y catálogos/conexión PMO.
-- Elimina únicamente datos creados durante pruebas: objetivos, indicadores,
-- mediciones, solicitudes, análisis, acciones y sus historiales relacionados.

begin;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    -- Evidencias y flujos derivados de mediciones
    'corrective_evidence',
    'corrective_events',
    'corrective_tasks',
    'corrective_actions',
    'cause_analyses',

    -- Solicitudes, auditoría e historial de indicadores
    'indicator_change_audit',
    'indicator_change_requests',
    'indicator_target_history',

    -- Asignaciones y reportes por sede
    'indicator_reporting_supports',
    'indicator_reports',
    'indicator_site_assignments',

    -- Selecciones de indicadores de GCG y GG
    'general_manager_indicators',
    'core_indicators',

    -- Datos estratégicos operativos
    'strategic_actions',
    'projects',
    'indicators',
    'objectives'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('delete from public.%I', table_name);
    end if;
  end loop;
end
$$;

commit;

-- Verificación esperada: todos estos conteos deben quedar en 0.
select
  (select count(*) from public.objectives) as objetivos,
  (select count(*) from public.indicators) as indicadores,
  (select count(*) from public.indicator_reports) as mediciones,
  (select count(*) from public.indicator_change_requests) as solicitudes;
