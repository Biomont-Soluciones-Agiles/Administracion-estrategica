import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ExternalLink, Link2, Search, User, X } from 'lucide-react';
import { supabase } from './lib/supabase';

const field = 'rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm';
const date = value => value ? new Date(value + 'T12:00:00').toLocaleDateString('es-PE') : 'Sin fecha';
const stamp = value => value ? new Date(value).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'Sin actualización';
function Progress({ value }) {
  return <div><div className="mb-2 flex justify-between text-xs text-slate-500"><span>Avance</span><strong className="text-lg text-blue-700">{value ?? 0}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} /></div></div>;
}

export default function PmoProjects({ objective, projects, canManage, onReload, onNotify }) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') onReload(); };
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, [onReload]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    supabase.from('pmo_project_catalog').select('*').order('code').then(({ data, error: failure }) => {
      if (!active) return;
      setCatalog(data || []);
      setError(failure ? 'No se pudo cargar el catálogo temporal. Verifica que esté instalada la migración 028.' : '');
      setLoading(false);
    });
    return () => { active = false; };
  }, [open]);
  const linked = new Set(projects.map(project => project.catalog_id).filter(Boolean));
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const rows = catalog.filter(project => normalize(project.code + ' ' + project.name).includes(normalize(search)) && (!status || project.status === status));
  const mutate = async (name, args, message) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { error: failure } = await supabase.rpc(name, args);
      if (failure) throw failure;
      await onReload();
      onNotify(message);
      setOpen(false); setSelected([]);
    } catch (failure) { setError(failure.message || 'No se pudo completar la operación.'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-xl border border-slate-200 bg-white p-5">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-3"><h3 className="text-lg font-bold text-slate-900">Proyectos vinculados</h3></div>{canManage && <button onClick={() => { setSelected([]); setOpen(true); setError(''); }} className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"><Link2 className="h-4 w-4" />Vincular proyecto PMO</button>}</header>
    {error && !open && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="space-y-3">{projects.map(project => <article key={project.id} className="rounded-xl border border-slate-200 p-5"><div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]"><div><div className="mb-2 flex items-center gap-2 text-xs text-slate-500"><span className="rounded bg-slate-100 px-2 py-1">{project.catalog_id ? 'DEMO PMO' : 'Registro anterior'}</span><span>{project.code || ''}</span><span className="ml-auto rounded-full bg-blue-50 px-2 py-1 text-blue-700">{project.status}</span></div><h4 className="font-semibold text-slate-900">{project.name}</h4><p className="mt-1 text-sm text-slate-500">{project.description || 'Sin descripción'}</p><div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500"><p className="flex items-center gap-2"><User className="h-4 w-4" />Responsable: {project.responsible_name || 'Sin asignar'}</p><p className="flex items-center gap-2"><Calendar className="h-4 w-4" />Fecha de término: {date(project.end_date)}</p></div></div><div className="flex flex-col justify-between gap-5 lg:border-l lg:border-slate-100 lg:pl-5"><Progress value={project.progress} /><div className="flex flex-wrap items-center justify-between gap-3 text-xs"><span className="text-slate-500">Actualizado en catálogo · {stamp(project.updated_at)}</span><div className="flex items-center gap-3">{project.project_url && <a href={project.project_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-blue-700">Ver en PMO<ExternalLink className="h-3 w-3" /></a>}{canManage && <button disabled={busy} onClick={() => { if (window.confirm('¿Desvincular este proyecto del objetivo? El proyecto seguirá en el catálogo.')) mutate('unlink_catalog_project', { project: project.id }, 'Proyecto desvinculado.'); }} className="rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">Desvincular</button>}</div></div></div></div></article>)}{!projects.length && <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Selecciona un proyecto del catálogo para vincularlo a este objetivo.</div>}</div>
    <p className="mt-4 text-xs text-slate-400">Datos de ejemplo. La conexión oficial a PMO aún está pendiente.</p>
    {open && createPortal(<div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Vincular proyecto de PMO" onKeyDown={event => { if (event.key === 'Escape' && !busy) setOpen(false); }}><div className="flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex items-start justify-between p-6"><div><h2 className="text-xl font-bold">Vincular proyecto de PMO</h2><p className="mt-1 text-sm text-slate-500">Selecciona uno o varios proyectos del catálogo</p></div><button autoFocus disabled={busy} aria-label="Cerrar" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header><div className="flex flex-wrap gap-3 px-6 pb-4"><label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input aria-label="Buscar proyecto" placeholder="Buscar por nombre o código" value={search} onChange={event => setSearch(event.target.value)} className={field + ' w-full pl-10'} /></label><select aria-label="Estatus de proyectos" value={status} onChange={event => setStatus(event.target.value)} className={field}><option value="">Todos los estados</option>{['En ejecución', 'Planificado', 'Concluido', 'En pausa'].map(item => <option key={item}>{item}</option>)}</select></div>{error && <p role="alert" className="mx-6 mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="space-y-3 overflow-y-auto px-6 pb-5">{loading ? <p className="p-8 text-center text-slate-500">Cargando proyectos…</p> : rows.map(project => <label key={project.id} className={`flex cursor-pointer flex-wrap items-center gap-4 rounded-xl border p-4 ${selected.includes(project.id) ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200'} ${linked.has(project.id) ? 'opacity-50' : ''}`}><input type="checkbox" name="pmo-project" value={project.id} disabled={busy || linked.has(project.id)} checked={selected.includes(project.id)} onChange={() => setSelected(current => current.includes(project.id) ? current.filter(id => id !== project.id) : [...current, project.id])} /><span className="text-xs text-slate-500">{project.code}</span><div className="min-w-48 flex-1"><p className="text-sm font-semibold">{project.name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{project.description}</p></div><span className="rounded-lg bg-blue-50 px-2 py-1 text-xs text-blue-700">{linked.has(project.id) ? 'Ya vinculado' : project.status}</span><div className="w-36"><Progress value={project.progress} /></div></label>)}{!loading && !rows.length && <p className="p-8 text-center text-sm text-slate-500">No hay proyectos que coincidan con la búsqueda.</p>}</div><footer className="flex items-center justify-between gap-3 border-t border-slate-100 p-5"><span className="text-xs text-slate-500">{selected.length ? `${selected.length} proyecto${selected.length === 1 ? '' : 's'} seleccionado${selected.length === 1 ? '' : 's'}` : 'Selecciona uno o varios proyectos'}</span><div className="flex gap-3"><button disabled={busy} onClick={() => setOpen(false)} className={field}>Cancelar</button><button disabled={busy || !selected.length} onClick={() => mutate('link_catalog_projects', { objective: objective.id, catalog_projects: selected }, 'Proyectos vinculados al objetivo.')} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Vinculando…' : 'Vincular proyectos'}</button></div></footer></div></div>, document.body)}
  </section>;
}
