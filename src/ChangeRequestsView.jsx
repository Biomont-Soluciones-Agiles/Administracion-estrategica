import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Filter, Search, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { requestGroups, requestStatus, requestPeriod } from './lib/requestViews';

const labels = { period: 'Periodo', target: 'Meta', comparator: 'Comparador', result: 'Resultado', name: 'Nombre', measurement_target: 'Meta histórica', measurement_comparator: 'Comparador histórico' };
const formatDate = date => date ? new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'medium' }).format(new Date(date)) : '—';
const requestType = kind => kind === 'target' ? 'Cambio de meta' : kind === 'report' ? 'Corrección de medición' : kind === 'delete_report' ? 'Eliminación de reporte' : kind === 'assign_support' ? 'Asignación de responsable de apoyo' : 'Cambio de nombre';
const requesterName = (request, users) => {
  const email = (request.requested_email || '').toLowerCase();
  const person = users.find(user => (user.email || user.id || '').toLowerCase() === email);
  return person?.full_name || person?.name || 'Usuario registrado';
};
function Values({ values }) {
  return <dl className="space-y-2">{Object.entries(values || {}).map(([key, value]) => <div key={key} className="flex flex-wrap justify-between gap-2"><dt className="text-slate-500">{labels[key] || key}</dt><dd className="font-medium text-slate-900 break-words">{String(value ?? '—')}</dd></div>)}{!Object.keys(values || {}).length && <p className="text-slate-400">Sin datos.</p>}</dl>;
}

function StatusPill({ request }) {
  const classes = request.status === 'Aprobado' ? 'bg-green-50 text-green-700 border-green-100' : request.status === 'Rechazado' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100';
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}>{requestStatus(request.status)}</span>;
}

export function RequestDetailDrawer({ request, indicator, users = [], reports = [], onClose, isGcg = false, canReview = false, reviewComment = '', onReviewComment, onReview, busy = false }) {
  if (!request) return null;
  const requester = requesterName(request, users);
  return createPortal(<div className="fixed inset-0 z-[120] flex justify-end bg-slate-950/25 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-label="Detalle de solicitud" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <button className="absolute inset-0 cursor-default" aria-label="Cerrar detalle" onClick={onClose} />
    <aside className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{request.direct ? 'Cambio' : 'Solicitud'} #{request.id} · {indicator?.code || '—'}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{request.direct ? 'Detalle de cambio' : 'Detalle de solicitud'}</h2></div><button onClick={onClose} aria-label="Cerrar detalle" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X className="h-5 w-5" /></button></header>
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-slate-500">Tipo de modificación</p><p className="mt-1 font-semibold text-slate-900">{requestType(request.kind)}</p></div><StatusPill request={request} /></div>
        <section><p className="text-sm text-slate-500">Indicador</p><p className="mt-1 font-semibold text-slate-900">{indicator?.name || 'Indicador no disponible'}</p></section>
        {requestPeriod(request, reports) && <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-slate-800">Periodo: {requestPeriod(request, reports)}</div>}
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2"><section className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="mb-3 font-semibold text-slate-900">Valor al enviar la solicitud</h3><Values values={request.previous} /></section><section className="rounded-xl border border-blue-100 bg-blue-50 p-4"><h3 className="mb-3 font-semibold text-slate-900">{request.direct ? 'Valor actualizado' : 'Cambio propuesto'}</h3><Values values={request.proposed} /></section></div>
        <section><h3 className="text-sm font-semibold text-slate-700">Motivo</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{request.reason || 'Sin motivo registrado.'}</p></section>
        <section className="grid grid-cols-2 gap-4 border-y border-slate-100 py-4 text-sm"><div><p className="text-slate-500">{request.direct ? 'Realizado por' : 'Solicitada por'}</p><p className="mt-1 font-semibold text-slate-900">{requester}</p></div><div><p className="text-slate-500">Enviada</p><p className="mt-1 font-semibold text-slate-900">{formatDate(request.created_at)}</p></div></section>
        {canReview && <label className="block"><span className="text-sm font-semibold text-slate-700">Comentarios de revisión <span className="font-normal text-slate-500">(obligatorio al rechazar)</span></span><textarea rows={4} value={reviewComment} onChange={event => onReviewComment?.(event.target.value)} placeholder="Escribe un comentario…" className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>}
        <section><h3 className="text-sm font-semibold text-slate-700">Trazabilidad</h3><ol className="mt-4 space-y-4 border-l border-slate-200 pl-5 text-sm"><li><p className="font-medium text-slate-900">{request.direct ? 'Cambio registrado' : 'Solicitud enviada'}</p><p className="text-slate-500">{formatDate(request.created_at)} · {requester}</p></li>{!request.direct && request.reviewed_at && <li><p className="font-medium text-slate-900">Revisión GCG</p><p className="text-slate-500">{formatDate(request.reviewed_at)} · {requestStatus(request.status)}</p></li>}{request.status === 'Aprobado' && <li><p className="font-medium text-slate-900">Cambio aplicado</p><p className="text-slate-500">El cambio fue incorporado al indicador.</p></li>}</ol></section>
        {request.review_comment && <section className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="text-sm font-semibold text-slate-700">Comentario GCG</h3><p className="mt-1 text-sm text-slate-600">{request.review_comment}</p></section>}
      </div>
      {canReview && <footer className="flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4"><button disabled={busy || !reviewComment.trim()} onClick={() => onReview?.(false)} className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">Rechazar</button><button disabled={busy} onClick={() => onReview?.(true)} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Procesando…' : 'Aprobar cambio'}</button></footer>}
    </aside>
  </div>, document.body);
}

export function IndicatorRequestFlyout({ indicatorId, indicators, users = [], reports = [], history = false, directHistory = false, onClose, onViewHistory }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const indicator = indicators.find(item => item.id === indicatorId);
  useEffect(() => {
    let active = true;
    const source = directHistory ? 'indicator_change_audit' : 'indicator_change_requests';
    supabase.from(source).select('*').eq('indicator_id', indicatorId).order('created_at', { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      setErrorMessage(error?.message || '');
      setRequests(directHistory ? (data || []).map(entry => ({ ...entry, direct: true, proposed: entry.current, requested_email: entry.changed_email, status: 'Aprobado', reviewed_at: entry.created_at })) : data || []);
      setLoading(false);
    });
    return () => { active = false; };
  }, [indicatorId, directHistory]);
  const visible = requestGroups(requests, history);
  return createPortal(<div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true" aria-label={directHistory ? 'Historial de cambios' : history ? 'Historial de solicitudes' : 'Solicitudes en revisión'} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <button className="absolute inset-0 bg-slate-950/10" aria-label="Cerrar panel de solicitudes" onClick={onClose} />
    <aside className="absolute right-4 top-24 max-h-[calc(100dvh-7rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl sm:right-8">
      <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{indicator?.code}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{directHistory ? 'Historial de cambios' : history ? 'Historial de solicitudes' : 'Solicitudes en revisión'}</h2><p className="mt-1 text-sm text-slate-500">{indicator?.name}</p></div><button onClick={onClose} aria-label="Cerrar solicitudes" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
      <div className="p-5">{loading ? <p className="py-10 text-center text-sm text-slate-500">Cargando solicitudes…</p> : errorMessage ? <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">No se pudieron cargar las solicitudes: {errorMessage}</p> : !visible.length ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No hay solicitudes {history ? 'en el historial' : 'en revisión'} para este indicador.</div> : <div className="divide-y divide-slate-100">{visible.slice(0, history && onViewHistory ? 5 : visible.length).map(request => <button key={request.id} type="button" onClick={() => setSelected(request)} className="w-full rounded-lg px-2 py-4 text-left transition hover:bg-slate-50"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{requestType(request.kind)}</p><p className="mt-1 text-xs text-slate-500">{formatDate(request.created_at)}</p></div><div className="flex items-center gap-2"><StatusPill request={request} /><ChevronRight className="h-4 w-4 text-slate-400" /></div></div></button>)}</div>}
        {history && onViewHistory && <button type="button" onClick={onViewHistory} className="mt-5 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Ver historial completo</button>}
      </div>
    </aside>
    {selected && <RequestDetailDrawer request={selected} indicator={indicator} users={users} reports={reports} onClose={() => setSelected(null)} />}
  </div>, document.body);
}

export default function ChangeRequestsView({ isGcg, indicators, users = [], reports = [], onReload, onError, indicatorId = null, initialHistory = false, onBack }) {
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState(initialHistory);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [comments, setComments] = useState({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [typeFilter, setTypeFilter] = useState('Todas');
  const [typeFilterOpen, setTypeFilterOpen] = useState(false);
  const typeFilterRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const load = async () => {
    setLoading(true);
    let request = supabase.from('indicator_change_requests').select('*').order('created_at', { ascending: false });
    if (indicatorId) request = request.eq('indicator_id', indicatorId);
    const { data, error } = await request;
    if (error) { setErrorMessage(error.message); onError?.(error.message); } else { setRequests(data || []); setErrorMessage(''); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [indicatorId]);
  useEffect(() => {
    const closeOnOutsideClick = event => {
      if (typeFilterRef.current && !typeFilterRef.current.contains(event.target)) setTypeFilterOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);
  const review = async (id, approve) => {
    setBusyId(id);
    const { error } = await supabase.rpc('review_indicator_change', { request_id: id, approve, review_comment: comments[id] || null });
    if (error) onError?.(error.message); else { await load(); await onReload?.(); }
    setBusyId(null);
  };
  const resolved = requestGroups(requests, history);
  const visible = useMemo(() => resolved.filter(request => {
    const terms = [requestType(request.kind), request.proposed?.period, requesterName(request, users), request.reason].filter(Boolean).join(' ').toLocaleLowerCase('es');
    return (!query.trim() || terms.includes(query.toLocaleLowerCase('es'))) && (statusFilter === 'Todas' || requestStatus(request.status) === statusFilter) && (typeFilter === 'Todas' || request.kind === typeFilter);
  }), [resolved, query, statusFilter, users]);
  const scopedIndicator = indicators.find(item => item.id === indicatorId);
  return <div className="fade-in space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div>{indicatorId && <p className="text-sm font-semibold text-blue-700">{scopedIndicator?.code}</p>}<h1 className="text-2xl font-bold text-slate-900">{indicatorId ? 'Historial de solicitudes' : history ? 'Historial de solicitudes' : 'Solicitudes'}</h1><p className="mt-2 text-slate-500">{indicatorId ? `${scopedIndicator?.name || 'Indicador'} · solicitudes registradas.` : history ? 'Solicitudes aprobadas o rechazadas por GCG.' : 'Los cambios enviados permanecen en revisión hasta que GCG los apruebe o rechace.'}</p></div>{!indicatorId && <div className="flex shrink-0 items-start justify-end gap-2"><div ref={typeFilterRef} className="relative"><button type="button" aria-label="Filtrar por tipo de modificación" aria-expanded={typeFilterOpen} onClick={() => setTypeFilterOpen(value => !value)} className={`rounded-lg border p-2.5 transition ${typeFilterOpen || typeFilter !== 'Todas' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}><Filter className="h-5 w-5" /></button>{typeFilterOpen && <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl"><div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-900">Filtrar solicitudes</p>{typeFilter !== 'Todas' && <button type="button" onClick={() => { setTypeFilter('Todas'); setTypeFilterOpen(false); }} className="text-xs font-semibold text-blue-700 hover:text-blue-900">Limpiar</button>}</div><label className="block text-sm font-medium text-slate-700">Tipo de modificación<select value={typeFilter} onChange={event => { setTypeFilter(event.target.value); setTypeFilterOpen(false); }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option value="Todas">Todos los tipos</option><option value="target">Cambio de meta</option><option value="report">Corrección de medición</option><option value="delete_report">Eliminación de reporte</option><option value="name">Cambio de nombre</option><option value="assign_support">Asignación de responsable de apoyo</option></select></label></div>}</div><button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setHistory(value => !value)}>{history ? 'Volver a solicitudes en revisión' : 'Ver historial de solicitudes'}</button></div>}</header>
    {indicatorId && <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center"><label className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar solicitud" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label><div className="flex gap-2">{['Todas', 'Aprobado', 'Rechazado'].map(value => <button key={value} onClick={() => setStatusFilter(value)} className={`rounded-full px-3 py-2 text-xs font-semibold ${statusFilter === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{value === 'Todas' ? value : `${value}s`}</button>)}</div></div>}
    {indicatorId && onBack && <button onClick={onBack} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Volver al indicador</button>}
    {loading ? <p className="p-8 text-center text-slate-500">Cargando solicitudes…</p> : errorMessage ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"><p>No se pudieron cargar las solicitudes: {errorMessage}</p><button className="mt-3 underline" onClick={load}>Reintentar</button></div> : <>
      <p className="text-sm text-slate-500">{visible.length} {history ? 'solicitudes resueltas' : 'solicitudes en revisión'}</p>
      {indicatorId && <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500"><tr>{['Fecha', 'Tipo', 'Periodo', 'Solicitada por', 'Estado', ''].map((label, index) => <th key={index} className="px-5 py-4">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visible.map(request => <tr key={request.id} className="cursor-pointer hover:bg-blue-50/40" onClick={() => setSelected(request)}><td className="px-5 py-4 text-slate-600">{formatDate(request.created_at)}</td><td className="px-5 py-4 font-medium text-slate-900">{requestType(request.kind)}</td><td className="px-5 py-4 text-slate-600">{requestPeriod(request, reports) || '—'}</td><td className="px-5 py-4 text-slate-600">{requesterName(request, users)}</td><td className="px-5 py-4"><StatusPill request={request} /></td><td className="px-5 py-4"><button aria-label={`Ver solicitud ${request.id}`} onClick={event => { event.stopPropagation(); setSelected(request); }}><ChevronRight className="h-4 w-4 text-slate-400" /></button></td></tr>)}</tbody></table></div>}
      {!indicatorId && visible.map(request => {
        const email = (request.requested_email || '').toLowerCase();
        const person = users.find(user => (user.email || user.id || '').toLowerCase() === email);
        const requester = person?.full_name || person?.name || 'Usuario registrado';
        const indicator = indicators.find(item => item.id === request.indicator_id);
        const status = requestStatus(request.status);
        const canReview = isGcg && !history && !request.direct;
        const proposedValues = Object.entries(request.proposed || {}).filter(([key]) => key !== 'period');
        const proposedSummary = proposedValues.length ? proposedValues.map(([key, value]) => `${labels[key] || key}: ${String(value ?? '—')}`).join(' · ') : 'Sin cambio registrado';
        return <article key={request.id} className="relative rounded-2xl border border-slate-200 bg-white px-5 py-4 pr-5 shadow-sm sm:px-6 sm:pr-6">
          <span className={`absolute right-5 top-4 rounded-full px-3 py-1 text-xs font-semibold sm:right-6 ${request.status === 'Aprobado' ? 'bg-green-50 text-green-700' : request.status === 'Rechazado' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{status}</span>
          <button type="button" onClick={() => setSelected(request)} className="block min-w-0 max-w-[calc(100%-8.5rem)] pb-14 text-left sm:max-w-[calc(100%-10rem)]"><p className="text-xs font-semibold text-blue-700">{request.direct ? 'Cambio' : 'Solicitud'} #{request.id} · {indicator?.code || '—'}</p><h2 className="mt-1 truncate text-lg font-semibold text-slate-900">{indicator?.name || 'Indicador no disponible'}</h2><p className="mt-1 truncate text-sm text-slate-500">{requestType(request.kind)} · {formatDate(request.created_at)} · <strong className="font-semibold text-slate-600">{requester}</strong></p><div className="mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:items-center"><span className="max-w-full truncate rounded-lg bg-blue-50 px-3 py-2 font-medium text-slate-700">{proposedSummary}</span><span className="truncate text-slate-600">Motivo: {request.reason || 'Sin motivo registrado.'}</span></div></button>
          <div className="absolute bottom-4 right-5 flex flex-wrap items-center justify-end gap-2 sm:right-6"><button type="button" onClick={() => setSelected(request)} className="rounded-lg border border-blue-300 px-3.5 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Ver detalle</button>{canReview && <><button type="button" disabled={busyId !== null} onClick={() => review(request.id, true)} className="rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{busyId === request.id ? 'Procesando…' : 'Aprobar'}</button><button type="button" onClick={() => setSelected(request)} className="rounded-lg border border-red-200 px-3.5 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Rechazar</button></>}</div>
        </article>;
      })}
      {!visible.length && <p className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">{history ? 'Todavía no hay solicitudes aprobadas o rechazadas.' : 'No hay solicitudes en revisión.'}</p>}
    </>}
    {selected && <RequestDetailDrawer request={selected} indicator={indicators.find(item => item.id === selected.indicator_id)} users={users} reports={reports} isGcg={isGcg} canReview={isGcg && !history && !selected.direct} reviewComment={comments[selected.id] || ''} onReviewComment={value => setComments(current => ({ ...current, [selected.id]: value }))} onReview={async approve => { await review(selected.id, approve); setSelected(null); }} busy={busyId === selected.id} onClose={() => setSelected(null)} />}
  </div>;
}
