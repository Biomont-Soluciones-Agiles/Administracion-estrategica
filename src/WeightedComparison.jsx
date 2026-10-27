import React, { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { displayUnit } from './lib/units';
import { MONTHS, parseReportPeriod } from './lib/reporting';
import { comparisonKey, historicalComparisonSeries } from './lib/historicalComparison';
import { measurementTicks } from './lib/indicatorViews';
import { measurementComplianceBand } from './lib/complianceBand';

const COLORS = ['#112B50', '#5B8FF9', '#16A34A', '#D97706', '#7C3AED'];
const formatValue = value => Number(value).toLocaleString('es-PE', { maximumFractionDigits: 4 });
const show = (value, unit) => value == null ? '—' : `${formatValue(value)} ${unit}`.trim();

function weightedReports(reports, assignments) {
  const weights = new Map(assignments.map(item => [String(item.id), Number(item.weight) > 0 ? Number(item.weight) : 1]));
  const groups = new Map();
  reports.forEach(report => { const rows = groups.get(report.period) || []; rows.push(report); groups.set(report.period, rows); });
  return [...groups.entries()].map(([period, rows]) => {
    const valid = rows.filter(row => row.result != null && Number.isFinite(Number(row.result)));
    if (!valid.length) return { id: `weighted-${period}`, period, result: null, status: 'Sin datos' };
    const total = valid.reduce((sum, row) => sum + (weights.get(String(row.assignmentId)) || 1), 0);
    return { id: `weighted-${period}`, period, result: valid.reduce((sum, row) => sum + Number(row.result) * (weights.get(String(row.assignmentId)) || 1), 0) / total, status: 'Ponderado' };
  });
}

function conditionClass(value, indicator) {
  if (value == null) return 'bg-slate-100 text-slate-400';
  const band = measurementComplianceBand(value, indicator.target, indicator.comparator).band;
  return ({ pesimista: 'bg-amber-200 text-slate-900 ring-1 ring-inset ring-amber-400', optimista: 'bg-emerald-100 text-slate-900 ring-1 ring-inset ring-emerald-200', excepcional: 'bg-blue-100 text-slate-900 ring-1 ring-inset ring-blue-200' })[band] || 'bg-slate-100 text-slate-700';
}

export default function WeightedComparison({ indicator, reports = [], assignments = [], onClose }) {
  const unit = displayUnit(indicator.unit);
  const weighted = useMemo(() => weightedReports(reports, assignments), [reports, assignments]);
  const years = useMemo(() => [...new Set(weighted.map(row => parseReportPeriod(row.period)?.year).filter(Boolean))].sort((a, b) => Number(b) - Number(a)), [weighted]);
  const [selectedYears, setSelectedYears] = useState([]);
  const activeYears = selectedYears.length >= 2 ? selectedYears : years.slice(0, 2);
  const data = historicalComparisonSeries(weighted, activeYears);
  const ticks = measurementTicks(data.map(row => Object.fromEntries(Object.entries(row).filter(([, value]) => typeof value === 'number'))), 0);
  const hasData = data.some(row => activeYears.some(year => row[comparisonKey(year)] != null));
  const toggleYear = value => setSelectedYears(current => {
    const active = current.length >= 2 ? current : years.slice(0, 2);
    if (active.includes(value)) return active.length > 2 ? active.filter(item => item !== value) : active;
    return [...active, value];
  });

  return <section aria-label="Gráfica comparativa ponderada">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-slate-900">Gráfica comparativa ponderada</h3><div className="flex items-center gap-2"><details className="relative"><summary className="cursor-pointer list-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50">Años seleccionados ({activeYears.length})</summary><div className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Selecciona dos o más años</p>{years.map(year => <label key={year} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={activeYears.includes(year)} onChange={() => toggleYear(year)} className="h-4 w-4 rounded border-slate-300 text-blue-700" />{year}</label>)}</div></details><button type="button" onClick={onClose} className="flex items-center gap-2 rounded-lg border border-blue-700 bg-blue-700 px-3 py-2 text-xs font-semibold text-white"><BarChart3 className="h-4 w-4" />Comparativa</button></div></header>
    {!hasData ? <p className="rounded-xl border border-slate-100 bg-slate-50 py-16 text-center text-sm text-slate-500">Sin mediciones para comparar.</p> : <><div className="h-[23rem] rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/60 to-white p-3"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 26, right: 32, left: 0, bottom: 42 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="period" tickMargin={12} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} /><YAxis ticks={ticks} domain={[ticks[0], ticks[ticks.length - 1]]} width={60} tickMargin={8} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={value => `${formatValue(value)}${unit === '%' ? '%' : ''}`} axisLine={false} tickLine={false} /><Tooltip formatter={value => show(value, unit)} />{activeYears.map((year, index) => <Line key={year} type="linear" dataKey={comparisonKey(year)} name={year} stroke={COLORS[index % COLORS.length]} strokeWidth={index === 0 ? 2.8 : 2.1} dot={{ r: 4, fill: COLORS[index % COLORS.length], stroke: '#fff', strokeWidth: 1.5 }} connectNulls={false} isAnimationActive={false} />)}</LineChart></ResponsiveContainer></div><div className="mt-3 flex flex-wrap justify-center gap-5 text-xs text-slate-600">{activeYears.map((year, index) => <span key={year} className="flex items-center gap-2"><i className="h-0.5 w-5" style={{ background: COLORS[index % COLORS.length] }} />{year}</span>)}</div><section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-200 bg-slate-50 px-4 py-3"><h4 className="font-semibold text-slate-900">Comparativa mensual ponderada</h4><p className="mt-0.5 text-xs text-slate-500">Valores ponderados por mes y año seleccionado.</p></div><div className="overflow-x-auto"><table className="min-w-[940px] w-full text-center text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 text-left font-semibold">Año</th>{MONTHS.map(month => <th key={month} className="px-3 py-3 font-semibold">{month.slice(0, 3)}</th>)}</tr></thead><tbody>{activeYears.map((year, index) => <tr key={year} className="border-t border-slate-100"><th scope="row" className="px-4 py-3 text-left font-semibold text-slate-800"><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />{year}</span></th>{data.map(row => <td key={row.period} className="px-1 py-1"><span className={'block rounded-md px-2 py-2 font-medium ' + conditionClass(row[comparisonKey(year)], indicator)}>{show(row[comparisonKey(year)], unit)}</span></td>)}</tr>)}</tbody></table></div><div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-600"><span className="font-semibold text-slate-700">Condición:</span><span>🟧 Pesimista</span><span>🟩 Optimista</span><span>🟦 Excepcional</span><span>⬜ Sin medición</span></div></section></>}</section>;
}
