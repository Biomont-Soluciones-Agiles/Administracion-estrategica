-- API de integración con PMO: consulta de objetivos activos, vinculación y
-- aprobación GCG de solicitudes de desvinculación.
begin;

create table if not exists public.pmo_project_link_requests (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('linked', 'unlink_requested')),
  status text not null check (status in ('notified', 'pending', 'approved', 'rejected')),
  objective_id bigint not null references public.objectives(id) on delete cascade,
  catalog_project_id uuid not null references public.pmo_project_catalog(id) on delete restrict,
  project_id bigint references public.projects(id) on delete set null,
  requested_by text not null default 'PMO API',
  requested_at timestamptz not null default now(),
  processed_by uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  decision_note text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists pmo_project_link_requests_pending_idx
  on public.pmo_project_link_requests(status, requested_at desc);
create index if not exists pmo_project_link_requests_objective_idx
  on public.pmo_project_link_requests(objective_id, requested_at desc);

alter table public.pmo_project_link_requests enable row level security;
grant select on public.pmo_project_link_requests to authenticated;

drop policy if exists "GCG reads PMO project link requests" on public.pmo_project_link_requests;
create policy "GCG reads PMO project link requests"
  on public.pmo_project_link_requests for select to authenticated
  using (public.is_gcg());

create or replace function public.process_pmo_project_unlink_request(
  request_id uuid,
  approve boolean,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.pmo_project_link_requests;
begin
  if not public.is_gcg() then
    raise exception 'Solo GCG puede atender solicitudes de desvinculación de PMO';
  end if;

  select * into request_row
  from public.pmo_project_link_requests
  where id = request_id
    and event_type = 'unlink_requested'
    and status = 'pending'
  for update;

  if not found then
    raise exception 'La solicitud no existe o ya fue atendida';
  end if;

  if approve and request_row.project_id is not null then
    update public.strategic_actions
    set project_id = null
    where project_id = request_row.project_id;

    delete from public.projects where id = request_row.project_id;
  end if;

  update public.pmo_project_link_requests
  set status = case when approve then 'approved' else 'rejected' end,
      processed_by = auth.uid(),
      processed_at = now(),
      decision_note = nullif(trim(note), '')
  where id = request_row.id;
end;
$$;

revoke all on function public.process_pmo_project_unlink_request(uuid, boolean, text) from public, anon;
grant execute on function public.process_pmo_project_unlink_request(uuid, boolean, text) to authenticated;

notify pgrst, 'reload schema';
commit;
