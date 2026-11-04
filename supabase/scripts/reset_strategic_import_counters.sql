-- Reinicia los códigos para una nueva carga estratégica desde el primer correlativo.
-- Seguridad: se niega a ejecutarse si existen objetivos o indicadores.
begin;

do $$
begin
  if exists (select 1 from public.objectives)
     or exists (select 1 from public.indicators) then
    raise exception 'No se reiniciaron los correlativos: todavía existen objetivos o indicadores.';
  end if;
end;
$$;

delete from public.entity_code_counters
where entity_type in ('OBJ', 'IND');

commit;

select
  (select count(*) from public.objectives) as objetivos,
  (select count(*) from public.indicators) as indicadores,
  coalesce((select last_number from public.entity_code_counters where entity_type = 'OBJ' and code_year = 2026), 0) as ultimo_objetivo_2026,
  coalesce((select last_number from public.entity_code_counters where entity_type = 'IND' and code_year = 2026), 0) as ultimo_indicador_2026;
