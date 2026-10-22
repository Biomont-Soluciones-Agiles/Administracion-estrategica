-- Responsables habilitados por sede para la creación de indicadores.
-- Chiara Pedraglio y John Cardenas: Kuntur Pharma.
-- Ángel Pérez: Biomont Ecuador.

begin;

create table if not exists public.site_responsibles (
  site_id bigint not null references public.sites(id) on delete cascade,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (site_id, email)
);

alter table public.site_responsibles enable row level security;
grant select on public.site_responsibles to authenticated;

drop policy if exists "Read site responsibles" on public.site_responsibles;
drop policy if exists "GCG manages site responsibles" on public.site_responsibles;

create policy "Read site responsibles"
  on public.site_responsibles for select to authenticated using (true);

create policy "GCG manages site responsibles"
  on public.site_responsibles for all to authenticated
  using (is_gcg()) with check (is_gcg());

do $$
declare
  v_kuntur_id bigint;
  v_ecuador_id bigint;
begin
  select id into v_kuntur_id
  from public.sites
  where lower(trim(name)) in ('kuntur pharma', 'kuntur', 'kunthur')
  order by case lower(trim(name))
    when 'kuntur pharma' then 0
    else 1
  end
  limit 1;

  select id into v_ecuador_id
  from public.sites
  where lower(trim(name)) = 'biomont ecuador'
  limit 1;

  if v_kuntur_id is null or v_ecuador_id is null then
    raise exception 'Primero deben existir las sedes Kuntur Pharma y Biomont Ecuador.';
  end if;

  -- John Cardenas usa la identidad Kuntur ya registrada.
  insert into public.site_responsibles(site_id, email, active)
  values (v_kuntur_id, 'jcardenas@kunturpharma.pe', true)
  on conflict (site_id, email) do update
  set active = true, updated_at = now();

  -- Chiara Pedraglio y Ángel Pérez se resuelven desde el directorio Microsoft
  -- u organización; no se inventan correos si su cuenta aún no está sincronizada.
  insert into public.site_responsibles(site_id, email, active)
  select distinct v_kuntur_id, lower(trim(person.email)), true
  from (
    select email, full_name from public.microsoft_directory
    union
    select email, full_name from public.organization_people
  ) person
  where nullif(trim(person.email), '') is not null
    and lower(person.full_name) like '%chiara%'
    and lower(person.full_name) like '%pedraglio%'
  on conflict (site_id, email) do update
  set active = true, updated_at = now();

  insert into public.site_responsibles(site_id, email, active)
  select distinct v_ecuador_id, lower(trim(person.email)), true
  from (
    select email, full_name from public.microsoft_directory
    union
    select email, full_name from public.organization_people
  ) person
  where nullif(trim(person.email), '') is not null
    and lower(person.full_name) like '%ngel%'
    and lower(person.full_name) like '%perez%'
  on conflict (site_id, email) do update
  set active = true, updated_at = now();
end $$;

notify pgrst, 'reload schema';
commit;

select s.name as sede, r.email
from public.site_responsibles r
join public.sites s on s.id = r.site_id
where r.active
order by s.name, r.email;
