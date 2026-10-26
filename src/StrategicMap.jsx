import React from 'react';
import { createPortal } from 'react-dom';
import { CircleDollarSign, GraduationCap, Users, X, Cog, Target, ChevronRight, ExternalLink } from 'lucide-react';
import { displayUnit } from './lib/units';

const FOCI = [
  { key: 'Financiero', label: 'Financiero', Icon: CircleDollarSign, panel: 'border-amber-100 bg-amber-50/80', tile: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white', connector: '#b7791f' },
  { key: 'Cliente', label: 'Cliente', Icon: Users, panel: 'border-teal-100 bg-teal-50/80', tile: 'bg-gradient-to-br from-teal-500 to-teal-700 text-white', connector: '#0f766e' },
  { key: 'Procesos', label: 'Procesos', Icon: Cog, panel: 'border-blue-100 bg-blue-50/80', tile: 'bg-gradient-to-br from-blue-500 to-blue-700 text-white', connector: '#2563eb' },
  { key: 'Personas/Aprendizaje', label: 'Personas / Aprendizaje', Icon: GraduationCap, panel: 'border-violet-100 bg-violet-50/80', tile: 'bg-gradient-to-br from-violet-500 to-violet-700 text-white', connector: '#7c3aed' },
];

const reportTime = report => new Date(report.date || report.registered_date || report.created_at || 0).getTime();

function currentMeasurement(objective, indicators, reports) {
  const rows = indicators.filter(indicator => String(indicator.objectiveId) === String(objective.id));
  const latest = rows.map(indicator => ({
    indicator,
    report: reports
      .filter(report => String(report.indicatorId) === String(indicator.id))
      .sort((a, b) => reportTime(a) - reportTime(b))
      .at(-1),
  })).filter(item => item.report?.result != null);

  if (!latest.length) return { label: 'Sin medición', value: '—', tone: 'muted' };

  const outOfTarget = latest.some(item => item.report.status === 'Fuera de meta');
  const inTarget = latest.every(item => item.report.status === 'En meta');
  const tone = outOfTarget ? 'risk' : inTarget ? 'success' : 'muted';
  const label = outOfTarget ? 'Fuera de meta' : inTarget ? 'En meta' : 'Con medición';

  if (latest.length === 1) {
    const { indicator, report } = latest[0];
    return { label, value: `${report.result} ${displayUnit(indicator.unit)}`.trim(), tone };
  }

  return { label, value: `${latest.length}/${rows.length} medidos`, tone };
}

function InfoRow({ label, value }) {
  return <div className="flex min-w-0 justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
    <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
    <dd className="min-w-0 text-right text-xs font-medium leading-5 text-slate-800">{value || '—'}</dd>
  </div>;
}

function ObjectiveDetail({ objective, indicators, reports, projects = [], actions = [], users = [], isGeneralManager = false, close, openIndicator, canSelectIndicator }) {
  if (!objective) return null;
  const rows = indicators.filter(i => String(i.objectiveId) === String(objective.id));
  const objectiveProjects = projects.filter(project => String(project.objectiveId) === String(objective.id));
  const objectiveActions = actions.filter(action => String(action.objectiveId) === String(objective.id));
  const measured = rows.filter(i => reports.some(r => String(r.indicatorId) === String(i.id))).length;
  const personName = id => users.find(user => String(user.id).toLowerCase() === String(id || '').toLowerCase() || String(user.email || '').toLowerCase() === String(id || '').toLowerCase())?.name || id || 'Sin asignar';
  const statusPill = status => <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{status || 'Sin estado'}</span>;
  return createPortal(<div role="dialog" aria-modal="true" aria-label={`Detalle de ${objective.name}`} onMouseDown={e => { if (e.target === e.currentTarget) close(); }} className="fixed inset-0 z-[100] flex justify-end bg-slate-950/35 backdrop-blur-[1px]">
    <section className="flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-2xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white px-6 py-5"><div><p className="text-xs font-semibold uppercase text-blue-700">{objective.code || 'Objetivo'}</p><h2 className="detail-page-title mt-2">{objective.name}</h2></div><button onClick={close} aria-label="Cerrar detalle" className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
      <div className="flex-1 space-y-6 p-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800"><Target className="h-4 w-4" />{objective.focus === 'Personas/Aprendizaje' ? 'Personas / Aprendizaje' : objective.focus || 'Sin foco definido'}</span>
        {objective.description && <p className="text-sm leading-6 text-slate-600">{objective.description}</p>}
        <section aria-label="Información del objetivo" className="border-y border-slate-200"><dl className="grid gap-x-8 sm:grid-cols-2"><InfoRow label="Código" value={objective.code} /><InfoRow label="Responsable" value={personName(objective.ownerId)} /><InfoRow label="Avance" value={`${Number(objective.progress || 0)}%`} /><InfoRow label="Vigencia" value={objective.validityStartYear && objective.validityEndYear ? `${objective.validityStartYear} – ${objective.validityEndYear}` : null} /><InfoRow label="Indicador" value={rows.length ? (measured ? "Medido" : "Sin medición") : "Sin indicador"} /></dl></section>
        <section className="rounded-2xl border border-slate-200 bg-slate-100/80 p-4"><h3 className="detail-section-heading mb-3">Indicador del objetivo</h3><div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white px-4">{rows.map(i => { const latest = reports.filter(r => String(r.indicatorId) === String(i.id)).sort((a, b) => reportTime(a) - reportTime(b)).at(-1); return <article key={i.id} className="py-4"><h4 className="text-base font-bold text-slate-900">{i.name}</h4><dl className="mt-1"><InfoRow label="Medición actual" value={latest?.result == null ? 'Sin medición' : `${latest.result} ${displayUnit(i.unit)}`} /><InfoRow label="Meta" value={`${i.comparator || ''} ${i.target ?? ''} ${displayUnit(i.unit)}`.trim()} /></dl>{canSelectIndicator(i) && <button onClick={() => openIndicator(i)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900">Ver indicador <ChevronRight className="h-4 w-4" /></button>}</article>; })}{!rows.length && <p className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">Este objetivo aún no tiene indicador.</p>}</div></section>
        {isGeneralManager && <>
        <section className="rounded-2xl border border-slate-200 bg-slate-100/80 p-4"><div className="mb-3 flex items-center justify-between"><h3 className="detail-section-heading">Proyectos</h3><span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">{objectiveProjects.length}</span></div><div className="space-y-2">{objectiveProjects.map(project => <article key={project.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h4 className="font-semibold text-slate-900">{project.name}</h4>{project.description && <p className="mt-1 text-xs leading-5 text-slate-500">{project.description}</p>}<p className="mt-2 text-xs text-slate-500">Responsable: {personName(project.ownerId)}</p></div>{statusPill(project.status)}</div>{project.project_url && <div className="mt-3 flex justify-end border-t border-slate-100 pt-3"><a href={project.project_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50">Ver en PMO <ExternalLink className="h-3.5 w-3.5" /></a></div>}</article>)}{!objectiveProjects.length && <p className="rounded-xl border border-dashed p-4 text-center text-sm text-slate-500">No hay proyectos vinculados.</p>}</div></section>
        <section className="rounded-2xl border border-slate-200 bg-slate-100/80 p-4"><div className="mb-3 flex items-center justify-between"><h3 className="detail-section-heading">Acciones estratégicas</h3><span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">{objectiveActions.length}</span></div><div className="space-y-2">{objectiveActions.map(action => <article key={action.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h4 className="font-semibold text-slate-900">{action.name}</h4>{action.description && <p className="mt-1 text-xs leading-5 text-slate-500">{action.description}</p>}<p className="mt-2 text-xs text-slate-500">Responsable: {personName(action.ownerId)}{action.dueDate ? ` · Término: ${action.dueDate}` : ''}</p></div>{statusPill(action.status)}</div></article>)}{!objectiveActions.length && <p className="rounded-xl border border-dashed p-4 text-center text-sm text-slate-500">No hay acciones estratégicas registradas.</p>}</div></section>
        </>}
      </div>
      {!isGeneralManager && <footer className="sticky bottom-0 border-t bg-white p-4"><button onClick={close} className="w-full rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-100">Volver al mapa BSC</button></footer>}
    </section>
  </div>, document.body);
}

export default function StrategicMap({ objectives = [], indicators = [], reports = [], projects = [], actions = [], users = [], isGeneralManager = false, onSelectIndicator, canSelectIndicator = () => true }) {
  const [selected, setSelected] = React.useState(null);
  return <section className="flex min-h-[calc(100vh-7rem)] flex-col" aria-label="Mapa estratégico BSC">
    <header className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D71920]">Gestión Estratégica</p><h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">Mapa estratégico BSC</h1><p className="mt-1 text-sm text-slate-500">Objetivos organizados por foco estratégico</p></header>
    <div className="relative flex-1 space-y-4 pb-4">{FOCI.map(({ key, label, Icon, panel, tile }) => {
      const rows = objectives.filter(objective => objective.focus === key);
      return <section key={key} aria-label={`Foco ${label}`} className={`relative z-10 grid min-h-[150px] grid-cols-[132px_minmax(0,1fr)] gap-4 rounded-2xl border p-3 md:grid-cols-[170px_minmax(0,1fr)] md:p-4 ${panel} max-md:grid-cols-1`}>
        <div className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl px-3 py-4 text-center shadow-sm ${tile}`}><Icon className="h-7 w-7" /><h2 className="text-base font-bold leading-5">{label}</h2></div>
        <div className="grid min-w-0 grid-cols-1 content-center gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map(objective => {
          const current = currentMeasurement(objective, indicators, reports);
          const dot = current.tone === 'success' ? 'bg-emerald-500' : current.tone === 'risk' ? 'bg-red-500' : 'bg-slate-400';
          return <button key={objective.id} onClick={() => setSelected(objective)} className="group min-h-28 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><span className="block text-[11px] font-bold text-slate-500">{objective.code || 'OBJ'}</span><span className="mt-1 line-clamp-2 block text-sm font-semibold leading-5 text-slate-900">{objective.name}</span><span className="mt-4 flex items-end justify-between gap-2 border-t border-slate-100 pt-2"><span className="text-lg font-bold text-slate-900">{current.value}</span><span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-600"><i className={`h-2 w-2 rounded-full ${dot}`} />{current.label}</span></span></button>;
        })}{!rows.length && <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/50 px-4 text-center text-sm text-slate-500">No hay objetivos en este foco.</div>}</div>
      </section>;
    })}</div>
    <ObjectiveDetail objective={selected} indicators={indicators} reports={reports} projects={projects} actions={actions} users={users} isGeneralManager={isGeneralManager} close={() => setSelected(null)} openIndicator={onSelectIndicator} canSelectIndicator={canSelectIndicator} />
  </section>;
}
