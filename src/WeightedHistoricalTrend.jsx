import React, { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { displayUnit } from './lib/units';
import { MONTHS, parseReportPeriod } from './lib/reporting';
import { measurementTicks } from './lib/indicatorViews';
import { measurementComplianceBand } from './lib/complianceBand';
import WeightedComparison from './WeightedComparison';

const NAVY = '#112B50';
const SITE_COLORS = ['#2563EB', '#16A34A', '#D97706', '#7C3AED'];
const months = MONTHS.map((name, index) => ({ name, short: name.slice(0, 3), index }));

const formatValue = value => Number(value).toLocaleString('es-PE', { maximumFractionDigits: 4 });
const valueWithUnit = (value, unit) => value == null ? '—' : `${formatValue(value)} ${unit}`.trim();

function cellClass(value, indicator) {
  if (value == null) return 'bg-slate-100 text-slate-400';
  const band = measurementComplianceBand(value, indicator.target, indicator.comparator).band;
  if (band === 'pesimista') return 'bg-amber-200 text-slate-900 ring-1 ring-inset ring-amber-400';
  if (band === 'optimista') return 'bg-emerald-100 text-slate-900 ring-1 ring-inset ring-emerald-200';
  if (band === 'excepcional') return 'bg-blue-100 text-slate-900 ring-1 ring-inset ring-blue-200';
  return 'bg-slate-100 text-slate-700';
}

function weightedValue(reports, assignments) {
  const weights = new Map(assignments.map(assignment => [String(assignment.id), Number(assignment.weight) > 0 ? Number(assignment.weight) : 1]));
  const valid = reports.filter(report => report.result != null && Number.isFinite(Number(report.result)));
  if (!valid.length) return null;
  const totalWeight = valid.reduce((total, report) => total + (weights.get(String(report.assignmentId)) || 1), 0);
  return valid.reduce((total, report) => total + Number(report.result) * (weights.get(String(report.assignmentId)) || 1), 0) / totalWeight;
}

export default function WeightedHistoricalTrend({ indicator, reports = [], assignments = [], sites = [], year = '' }) {
  const [comparison, setComparison] = useState(false);
  const unit = displayUnit(indicator.unit);
  const definitions = assignments.filter(item => item.active !== false).map((assignment, index) => ({
    assignment,
    site: sites.find(site => String(site.id) === String(assignment.site_id)),
    color: SITE_COLORS[index % SITE_COLORS.length],
  })).filter(item => item.site);

  const data = useMemo(() => months.map(month => {
    const monthlyReports = reports.filter(report => {
      const period = parseReportPeriod(report.period);
      return period?.year === String(year) && period.month === month.name.toLowerCase();
    });
    const row = { period: month.short, ponderado: weightedValue(monthlyReports, assignments) };
    definitions.forEach(item => {
      const report = monthlyReports.find(value => String(value.assignmentId) === String(item.assignment.id));
      row[`site_${item.assignment.id}`] = report?.result ?? null;
    });
    return row;
  }), [reports, assignments, definitions, year]);

  const tickRows = data.map(row => {
    const values = {};
    Object.entries(row).forEach(([key, value]) => { if (typeof value === 'number') values[key] = value; });
    return values;
  });
  const ticks = measurementTicks(tickRows, indicator.target);
  const hasData = data.some(row => row.ponderado != null);
  const tableRows = [
    { name: 'Ponderado', color: NAVY, key: 'ponderado' },
    ...definitions.map(item => ({ name: item.site.name, color: item.color, key: `site_${item.assignment.id}` })),
  ];

  if (comparison) return <WeightedComparison indicator={indicator} reports={reports} assignments={assignments} onClose={() => setComparison(false)} />;

  return <section aria-label="Tendencia histórica ponderada">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-slate-900">Tendencia histórica ponderada · {year}</h3><button type="button" onClick={() => setComparison(true)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:border-blue-300 hover:bg-blue-50">Comparativa</button></header>
    {!hasData ? <p className="rounded-xl border border-slate-100 bg-slate-50 py-16 text-center text-sm text-slate-500">Sin mediciones para ponderar en {year}.</p> : <>
      <div className="h-[23rem] rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/60 to-white p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 26, right: 32, left: 0, bottom: 42 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="period" tickMargin={12} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
            <YAxis ticks={ticks} domain={[ticks[0], ticks[ticks.length - 1]]} width={60} tickMargin={8} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={value => `${formatValue(value)}${unit === '%' ? '%' : ''}`} axisLine={false} tickLine={false} />
            <Tooltip formatter={value => valueWithUnit(value, unit)} />
            <Line type="linear" dataKey="ponderado" name="Ponderado" stroke={NAVY} strokeWidth={3} dot={{ r: 4.5, fill: NAVY, stroke: '#fff', strokeWidth: 1.5 }} connectNulls={false} isAnimationActive={false} />
            {definitions.map(item => <Line key={item.assignment.id} type="linear" dataKey={`site_${item.assignment.id}`} name={item.site.name} stroke={item.color} strokeWidth={2} dot={{ r: 3.5, fill: item.color, stroke: '#fff', strokeWidth: 1.2 }} connectNulls={false} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-600">{tableRows.map(row => <span key={row.key} className="flex items-center gap-2"><i className="h-0.5 w-5" style={{ background: row.color }} />{row.name}</span>)}</div>
      <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3"><h4 className="font-semibold text-slate-900">Detalle mensual ponderado</h4><p className="mt-0.5 text-xs text-slate-500">Ponderación consolidada y valor reportado por sede.</p></div>
        <div className="overflow-x-auto"><table className="min-w-[940px] w-full text-center text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 text-left font-semibold">Serie</th>{months.map(month => <th key={month.name} className="px-3 py-3 font-semibold">{month.short}</th>)}</tr></thead><tbody>{tableRows.map(row => <tr key={row.key} className="border-t border-slate-100"><th scope="row" className="whitespace-nowrap px-4 py-3 text-left font-semibold text-slate-800"><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />{row.name}</span></th>{data.map(month => <td key={month.period} className="px-1 py-1"><span className={'block rounded-md px-2 py-2 font-medium ' + cellClass(month[row.key], indicator)}>{valueWithUnit(month[row.key], unit)}</span></td>)}</tr>)}</tbody></table></div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-600"><span className="font-semibold text-slate-700">Condición:</span><span>🟧 Pesimista</span><span>🟩 Optimista</span><span>🟦 Excepcional</span><span>⬜ Sin medición</span></div>
      </section>
    </>}
  </section>;
}
