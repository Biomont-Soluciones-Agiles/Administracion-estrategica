-- LIMPIEZA PARA ENTREGA DE BIOMET.
-- Ejecutar manualmente en SQL Editor del proyecto de Supabase de esta app.
-- Exportar antes los datos si se desea poder recuperarlos.
-- Borra TODOS los datos operativos: objetivos, indicadores, selección Core,
-- reportes, acciones, proyectos, hallazgos y mensajes del tablero.
-- Conserva usuarios, perfiles, roles, sedes, catálogos, directorio,
-- políticas de seguridad, funciones y estructura de la app.
-- No se usa CASCADE: una dependencia no contemplada detiene la operación.
-- Los contadores de códigos se conservan para no reutilizar códigos antiguos.
-- Los archivos físicos de Storage se eliminan desde Storage, nunca por SQL.

begin;

do $$
declare
  operational_tables text[] := array[
    'corrective_evidence', 'corrective_events', 'corrective_tasks',
    'corrective_actions', 'cause_analyses', 'indicator_change_audit',
    'indicator_change_requests', 'indicator_target_history',
    'core_indicators', 'general_manager_indicators', 'indicator_site_assignments', 'indicator_reports',
    'indicators', 'strategic_actions', 'projects', 'objectives',
    'dashboard_messages'
  ];
  table_name text;
  targets text := '';
  profiles_before bigint;
  roles_before bigint;
  people_before bigint;
  users_before bigint;
begin
  select count(*) into profiles_before from public.profiles;
  select count(*) into roles_before from public.role_assignments;
  select count(*) into people_before from public.organization_people;
  select count(*) into users_before from auth.users;

  foreach table_name in array operational_tables loop
    -- Permite limpiar una instalación donde aún falte algún módulo.
    if to_regclass(format('public.%I', table_name)) is not null then
      targets := targets || case when targets = '' then '' else ', ' end
        || format('public.%I', table_name);
    end if;
  end loop;

  if targets = '' then
    raise exception 'No se encontraron tablas operativas; comprueba el proyecto.';
  end if;

  execute 'truncate table ' || targets;

  if profiles_before <> (select count(*) from public.profiles)
     or roles_before <> (select count(*) from public.role_assignments)
     or people_before <> (select count(*) from public.organization_people)
     or users_before <> (select count(*) from auth.users) then
    raise exception 'La verificación de usuarios y roles falló. Se revierte la limpieza.';
  end if;
end;
$$;

commit;

select 'Limpieza completada. Usuarios, accesos, roles, sedes y catálogos conservados.' as resultado;
