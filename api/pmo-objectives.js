import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ACTIVE_STATUS = 'activo';
const allowedOrigins = () => String(process.env.PMO_ALLOWED_ORIGINS || '')
  .split(',').map(item => item.trim()).filter(Boolean);
const json = (response, status, body) => response.status(status).json(body);

function cors(request, response) {
  const origin = request.headers.origin;
  if (origin && allowedOrigins().includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-API-Key');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function isAuthorized(request) {
  const expected = process.env.PMO_OBJECTIVES_API_KEY;
  const provided = request.headers['x-api-key'] || String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(String(provided));
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function normalizeText(value, limit = 500) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function validProject(input) {
  const code = normalizeText(input?.code, 80);
  const name = normalizeText(input?.name, 300);
  const progress = Number(input?.progress ?? 0);
  if (!code || !name || !Number.isFinite(progress) || progress < 0 || progress > 100) return null;
  return {
    code,
    name,
    description: normalizeText(input.description, 2000) || 'Sin descripción registrada.',
    responsible_name: normalizeText(input.responsible_name, 300) || 'Sin responsable asignado',
    status: normalizeText(input.status, 120) || 'Pendiente',
    progress: Math.round(progress),
    end_date: normalizeText(input.end_date, 10) || null,
    project_url: normalizeText(input.project_url, 1000) || null,
    is_demo: false,
    source: 'pmo_api',
    updated_at: new Date().toISOString(),
  };
}

async function activeObjective(supabase, objectiveCode) {
  const code = normalizeText(objectiveCode, 80);
  if (!code) return null;
  const { data, error } = await supabase.from('objectives')
    .select('id, code, name, status')
    .eq('code', code)
    .ilike('status', ACTIVE_STATUS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function linkProjects(supabase, body) {
  const objective = await activeObjective(supabase, body.objective_code);
  if (!objective) return { status: 404, body: { error: 'No existe un objetivo activo con ese código.' } };
  const projects = Array.isArray(body.projects) ? body.projects.map(validProject) : [];
  if (!projects.length || projects.some(project => !project)) return { status: 400, body: { error: 'Envía al menos un proyecto válido.' } };

  const { error: catalogError } = await supabase.from('pmo_project_catalog').upsert(projects, { onConflict: 'code' });
  if (catalogError) throw catalogError;
  const { data: catalogRows, error: catalogReadError } = await supabase.from('pmo_project_catalog')
    .select('id, code, name, status, progress').in('code', projects.map(project => project.code));
  if (catalogReadError) throw catalogReadError;

  const outcomes = [];
  for (const catalog of catalogRows || []) {
    const { data: existing, error: existingError } = await supabase.from('projects')
      .select('id').eq('objective_id', objective.id).eq('catalog_id', catalog.id).maybeSingle();
    if (existingError) throw existingError;
    const { data: linked, error: linkError } = await supabase.from('projects').upsert({
      objective_id: objective.id, catalog_id: catalog.id, name: catalog.name,
      status: catalog.status, progress: catalog.progress, source: 'PMO API', updated_at: new Date().toISOString(),
    }, { onConflict: 'objective_id,catalog_id' }).select('id').single();
    if (linkError) throw linkError;
    if (!existing) {
      const { error: notificationError } = await supabase.from('pmo_project_link_requests').insert({
        event_type: 'linked', status: 'notified', objective_id: objective.id,
        catalog_project_id: catalog.id, project_id: linked.id,
        payload: { objective_code: objective.code, project_code: catalog.code },
      });
      if (notificationError) throw notificationError;
    }
    outcomes.push({ project_code: catalog.code, linked: !existing });
  }
  return { status: 200, body: { objective_code: objective.code, results: outcomes } };
}

async function requestUnlink(supabase, body) {
  const objective = await activeObjective(supabase, body.objective_code);
  const projectCode = normalizeText(body.project_code, 80);
  if (!objective || !projectCode) return { status: 404, body: { error: 'No existe un objetivo activo o proyecto con esos códigos.' } };
  const { data: catalog, error: catalogError } = await supabase.from('pmo_project_catalog').select('id, code').eq('code', projectCode).maybeSingle();
  if (catalogError) throw catalogError;
  if (!catalog) return { status: 404, body: { error: 'No existe un proyecto PMO con ese código.' } };
  const { data: linked, error: linkError } = await supabase.from('projects').select('id')
    .eq('objective_id', objective.id).eq('catalog_id', catalog.id).maybeSingle();
  if (linkError) throw linkError;
  if (!linked) return { status: 404, body: { error: 'El proyecto no está vinculado a ese objetivo.' } };
  const { data: pending, error: pendingError } = await supabase.from('pmo_project_link_requests').select('id')
    .eq('objective_id', objective.id).eq('catalog_project_id', catalog.id).eq('event_type', 'unlink_requested').eq('status', 'pending').maybeSingle();
  if (pendingError) throw pendingError;
  if (pending) return { status: 202, body: { objective_code: objective.code, project_code: catalog.code, status: 'pending', request_id: pending.id } };
  const { data: request, error: requestError } = await supabase.from('pmo_project_link_requests').insert({
    event_type: 'unlink_requested', status: 'pending', objective_id: objective.id,
    catalog_project_id: catalog.id, project_id: linked.id,
    payload: { objective_code: objective.code, project_code: catalog.code, reason: normalizeText(body.reason, 1000) || null },
  }).select('id').single();
  if (requestError) throw requestError;
  return { status: 202, body: { objective_code: objective.code, project_code: catalog.code, status: 'pending', request_id: request.id } };
}

export default async function handler(request, response) {
  cors(request, response);
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (!['GET', 'POST'].includes(request.method)) { response.setHeader('Allow', 'GET, POST, OPTIONS'); return json(response, 405, { error: 'Método no permitido.' }); }
  if (!isAuthorized(request)) return json(response, 401, { error: 'No autorizado.' });
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return json(response, 503, { error: 'La integración no está configurada.' });
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    if (request.method === 'GET') {
      const updatedSince = normalizeText(request.query?.updated_since, 40);
      let query = supabase.from('objectives').select('code, name, description, focus, updated_at')
        .ilike('status', ACTIVE_STATUS).order('updated_at', { ascending: false });
      if (updatedSince) query = query.gt('updated_at', updatedSince);
      const { data, error } = await query;
      if (error) throw error;
      return json(response, 200, { data: data || [], generated_at: new Date().toISOString() });
    }
    const action = request.body?.action;
    const result = action === 'link' ? await linkProjects(supabase, request.body) : action === 'request_unlink' ? await requestUnlink(supabase, request.body) : { status: 400, body: { error: 'La acción debe ser link o request_unlink.' } };
    return json(response, result.status, result.body);
  } catch (error) {
    console.error('PMO objectives integration failed', { method: request.method, message: error instanceof Error ? error.message : 'Unknown error' });
    return json(response, 500, { error: 'No se pudo procesar la solicitud de PMO.' });
  }
}
