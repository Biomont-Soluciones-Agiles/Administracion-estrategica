import React, { useMemo, useState } from 'react';
import { BarChart3, CircleDollarSign, Cog, GraduationCap, Users } from 'lucide-react';
import { displayUnit } from './lib/units';
import { parseReportPeriod } from './lib/reporting';
import { targetForYear } from './lib/annualTargets';

const PERSPECTIVES = [
  { key: 'Financiero', title: 'Perspectiva financiera', Icon: CircleDollarSign, accent: 'border-amber-400', header: 'bg-amber-600', surface: 'bg-amber-50/50' },
  { key: 'Cliente', title: 'Perspectiva Cliente', Icon: Users, accent: 'border-teal-500', header: 'bg-teal-700', surface: 'bg-teal-50/40' },
  { key: 'Procesos', title: 'Perspectiva Procesos internos', Icon: Cog, accent: 'border-blue-600', header: 'bg-blue-700', surface: 'bg-blue-50/40' },
  { key: 'Personas/Aprendizaje', title: 'Perspectiva Aprendizaje y crecimiento', Icon: GraduationCap, accent: 'border-violet-600', header: 'bg-violet-700', surface: 'bg-violet-50/40' },
];

const sortByCode = (left, right) => String(left.code || '').localeCompare(String(right.code || ''), 'es', { numeric: true, sensitivity: 'base' });
const reportOrder = report => parseReportPeriod(report.period)?.order || 0;

function statusStyle(status) {
  if (status === 'En meta') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Fuera de meta') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export default function BscIndicatorsMap({ objectives = [], indicators = [], reports = [], annualTargets = [], sites = [], assignments = [], onSelectIndicator }) {
  const years = useMemo(() => [...new Set([String(new Date().getFullYear()), ...reports.map(report => parseReportPeriod(report.period)?.year).filter(Boolean)])].sort((a, b) => Number(b) - Number(a)), [reports]);
  const [year, setYear] = useState(years[0] || String(new Date().getFullYear()));
  const [siteId, setSiteId] = useState('');
  const activeSites = sites.filter(site => site.active !== false);
  const selectedSiteAssignments = new Set(assignments.filter(assignment => assignment.active !== false && (!siteId || String(assignment.site_id) === String(siteId))).map(assignment => String(assignment.id)));
  const filteredReports = reports.filter(report => parseReportPeriod(report.period)?.year === year && (!siteId || selectedSiteAssignments.has(String(report.assignmentId))));

  return <section className="mx-auto max-w-[1500px] space-y-4" aria-label="BSC Indicadores">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-300 pb-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D71920]">BioIndicadores</p><h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">BSC Indicadores</h1><p className="mt-1 text-sm text-slate-500">Indicadores organizados por perspectiva estratégica</p></div>
      <div className="flex flex-wrap gap-3"><label className="text-sm font-semibold text-slate-700">Año<select className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" value={year} onChange={event => setYear(event.target.value)}>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Sede<select className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" value={siteId} onChange={event => setSiteId(event.target.value)}><option value="">Todas</option>{activeSites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label></div>
    </header>
    <div className="space-y-3">{PERSPECTIVES.map(({ key, title, Icon, accent, header, surface }, index) => {
      const objectiveIds = new Set(objectives.filter(objective => objective.focus === key).map(objective => String(objective.id)));
      const rows = indicators.filter(indicator => objectiveIds.has(String(indicator.objectiveId))).sort(sortByCode);
      return <React.Fragment key={key}><section className={`overflow-hidden rounded-xl border border-slate-300 border-l-4 ${accent} ${surface}`}><header className={`flex items-center gap-2 px-4 py-2.5 text-white ${header}`}><Icon className="h-5 w-5"/><h2 className="text-base font-bold">{title}</h2><span className="ml-1 text-sm text-white/85">({rows.length} indicadores)</span></header><div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">{rows.map(indicator => {
        const latest = filteredReports.filter(report => String(report.indicatorId) === String(indicator.id)).sort((left, right) => reportOrder(right) - reportOrder(left) || Number(right.id) - Number(left.id))[0];
        const latestAssignment = assignments.find(assignment => String(assignment.id) === String(latest?.assignmentId));
        const target = targetForYear(indicator, annualTargets, year, siteId || latestAssignment?.site_id);
        const status = latest?.status || 'Sin reporte';
        return <button type="button" key={indicator.id} onClick={() => onSelectIndicator?.(indicator)} className="min-h-24 rounded-lg border border-slate-300 bg-white p-3 text-left shadow-sm transition hover:border-blue-400 hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-600"><p className="text-xs font-bold text-blue-700">{indicator.code}</p><p className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-900">{indicator.name}</p><div className="mt-2 flex items-end justify-between gap-2 border-t border-slate-100 pt-2"><p><span className="block text-lg font-bold text-slate-900">{latest?.result == null ? '—' : `${latest.result} ${displayUnit(indicator.unit)}`}</span><span className="block text-[11px] text-slate-500">Meta: {target.comparator} {target.target} {displayUnit(indicator.unit)}</span></p><span className={`whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold ${statusStyle(status)}`}>{status}</span></div></button>;
      })}{!rows.length && <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">No hay indicadores en esta perspectiva.</p>}</div></section>{index < PERSPECTIVES.length - 1 && <div className="flex justify-center text-slate-500">↓</div>}</React.Fragment>;
    })}</div>
  </section>;
}
