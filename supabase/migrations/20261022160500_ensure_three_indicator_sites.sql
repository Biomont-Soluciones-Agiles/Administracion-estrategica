-- Mantiene las tres sedes usadas por la asignación de responsables.
-- Ejecutar en Supabase > SQL Editor si las migraciones no se aplican automáticamente.

begin;

do $$
declare
  v_kuntur_pharma_id bigint;
  v_legacy_kuntur_id bigint;
begin
  select id into v_kuntur_pharma_id
  from public.sites
  where lower(trim(name)) = 'kuntur pharma'
  limit 1;

  select id into v_legacy_kuntur_id
  from public.sites
  where lower(trim(name)) in ('kuntur', 'kunthur')
  limit 1;

  -- Conserva las asignaciones existentes si había una sede con el nombre anterior.
  if v_kuntur_pharma_id is not null and v_legacy_kuntur_id is not null
     and v_kuntur_pharma_id <> v_legacy_kuntur_id then
    update public.indicator_site_assignments
    set site_id = v_kuntur_pharma_id, updated_at = now()
    where site_id = v_legacy_kuntur_id
      and not exists (
        select 1
        from public.indicator_site_assignments current_assignment
        where current_assignment.indicator_id = public.indicator_site_assignments.indicator_id
          and current_assignment.site_id = v_kuntur_pharma_id
      );

    delete from public.sites where id = v_legacy_kuntur_id;
  elsif v_kuntur_pharma_id is null and v_legacy_kuntur_id is not null then
    update public.sites
    set name = 'Kuntur Pharma', active = true
    where id = v_legacy_kuntur_id;
  elsif v_kuntur_pharma_id is null then
    insert into public.sites(name, active) values ('Kuntur Pharma', true);
  else
    update public.sites set active = true where id = v_kuntur_pharma_id;
  end if;
end $$;

insert into public.sites(name, active)
select 'Biomont Ecuador', true
where not exists (
  select 1 from public.sites where lower(trim(name)) = 'biomont ecuador'
);

update public.sites
set active = true
where lower(trim(name)) in ('biomont', 'kuntur pharma', 'biomont ecuador');

notify pgrst, 'reload schema';
commit;

select id, name, active
from public.sites
where lower(trim(name)) in ('biomont', 'kuntur pharma', 'biomont ecuador')
order by case lower(trim(name))
  when 'biomont' then 1
  when 'kuntur pharma' then 2
  else 3
end;
