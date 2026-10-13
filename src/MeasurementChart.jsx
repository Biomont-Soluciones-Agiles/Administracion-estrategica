import { displayUnit } from './lib/units';
import React, { useEffect, useMemo, useState } from 'react';
import { Filter } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { measurementSeries, measurementTicks } from './lib/indicatorViews';
import { deviationAssessment } from './lib/measurementDeviation';
import { parseReportPeriod } from './lib/reporting';
import { supabase } from './lib/supabase';

function MeasurementTooltip({ active, payload, label, unit, defaultComparator }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row || row.resultado == null) return null;
  const comparator = row.comparator || defaultComparator;
  const assessment = deviationAssessment(row.resultado, row.meta, comparator);
  const inTarget = assessment.status === 'en_meta';
  const status = inTarget ? 'En meta' : assessment.status === 'desviacion_moderada' ? 'Desviación moderada' : 'Desviación crítica';
  const tone = inTarget ? 'green' : assessment.status === 'desviacion_moderada' ? 'amber' : 'red';
  return <div className="min-w-56 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl">
    <p className="font-semibold text-slate-900">{label}</p>
    <div className="mt-3 space-y-2 text-sm">
      <p className="flex items-center justify-between gap-5 text-slate-600"><span>Meta de la medición</span><strong className="text-slate-900">{comparator} {row.meta} {unit}</strong></p>
      <p className="flex items-center justify-between gap-5 text-slate-600"><span>Resultado</span><strong className="text-blue-700">{row.resultado} {unit}</strong></p>
      {!inTarget && assessment.critical != null && <p className="flex items-center justify-between gap-5 text-slate-600"><span>Desviación crítica</span><strong className="text-slate-900">{assessment.critical} {unit}</strong></p>}
      <p className={`mt-2 flex w-fit items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${tone === 'green' ? 'bg-green-50 text-green-700' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}><span className={`h-2 w-2 rounded-full ${tone === 'green' ? 'bg-green-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}></span>{status}</p>
    </div>
  </div>;
}

export default function MeasurementChart({ indicator, reports, year: controlledYear, showYearFilter = true }) {
  const years = useMemo(() => [...new Set(reports.map(report => parseReportPeriod(report.period)?.year).filter(Boolean))].sort((a, b) => b - a), [reports]);
  const [localYear, setYear] = useState('');
  const year = controlledYear ?? localYear;
  const [history, setHistory] = useState([]);
  useEffect(() => { let active = true; setHistory([]); if (!supabase) return () => { active = false; }; supabase.from('indicator_target_history').select('*').eq('indicator_id', indicator.id).order('created_at').then(({ data }) => { if (active) setHistory(data || []); }); return () => { active = false; }; }, [indicator.id]);
  useEffect(() => { if (year && !years.includes(year)) setYear(''); }, [year, years]);
  const selectedReports = year ? reports.filter(report => parseReportPeriod(report.period)?.year === year) : reports;
  const resolvedReports = selectedReports.map(report => {
    if (report.measurement_target != null) return report;
    const recordedAt = report.created_at || report.registered_date || report.date;
    const nextChange = recordedAt && history.find(change => new Date(change.created_at) > new Date(recordedAt));
    return { ...report, measurement_target: nextChange ? nextChange.target : indicator.target, measurement_comparator: report.measurement_comparator || indicator.comparator };
  });
  const data = measurementSeries(resolvedReports).map(row => ({ ...row, ...deviationAssessment(row.resultado, row.meta, row.comparator || indicator.comparator) }));
  const ticks = measurementTicks(data, indicator.target);
  const ResultDot = ({ cx, cy, payload }) => {
    if (payload?.resultado == null || !Number.isFinite(Number(payload.resultado))) return null;
    const status = deviationAssessment(payload.resultado, payload.meta ?? indicator.target, payload.comparator || indicator.comparator).status;
    const color = status === 'en_meta' ? '#16a34a' : status === 'desviacion_moderada' ? '#d97706' : '#dc2626';
    return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#ffffff" strokeWidth={2} />;
  };
  if (!data.length) return <p className="py-16 text-center text-slate-500">Sin mediciones registradas.</p>;
  const hasCriticalLine = data.some(row => row.critical != null);
  const hasEqualityBounds = data.some(row => row.criticalLower != null && row.critical == null);
  return <section aria-label={`Gráfica de medición de ${indicator.name}`}>
    <div className="mb-4 flex items-center justify-between gap-4">{showYearFilter && <details className="relative"><summary aria-label="Filtrar tendencia" title="Filtrar tendencia" className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"><Filter className="h-4 w-4" /></summary><div className="absolute left-0 top-full z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"><p className="text-sm font-semibold text-slate-800">Filtrar tendencia</p><label htmlFor="measurement-year" className="mt-3 block text-xs font-medium uppercase tracking-wide text-slate-500">Año<select id="measurement-year" aria-label="Filtrar tendencia por año" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700" value={year} onChange={event => setYear(event.target.value)}><option value="">Todos los años</option>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label></div></details>}<div className="flex flex-wrap justify-end gap-x-4 gap-y-2 text-xs font-medium text-slate-600"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-green-600"></i>En meta</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-amber-500"></i>Desviación ≤ 20%</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-red-600"></i>Desviación crítica</span><span className="flex items-center gap-2"><i className="h-0.5 w-5 border-t-2 border-dashed border-amber-700"></i>Límite crítico</span><span className="flex items-center gap-2"><i className="h-0.5 w-5 bg-slate-900"></i>Meta</span></div></div>
    <div className="h-[21rem] rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50 via-white to-white p-3"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 24, right: 34, left: 18, bottom: 16 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="period" padding={{ left: 24, right: 24 }} tickMargin={12} tick={{ fontSize: 11, fill: '#475569' }} axisLine={{ stroke: '#94a3b8' }} /><YAxis ticks={ticks} interval={0} domain={[ticks[0], ticks[ticks.length - 1]]} width={80} tickMargin={14} tick={{ fontSize: 11, fill: '#475569' }} axisLine={{ stroke: '#94a3b8' }} /><Tooltip cursor={{ stroke: '#94a3b8', strokeWidth: 1 }} content={<MeasurementTooltip unit={displayUnit(indicator.unit)} defaultComparator={indicator.comparator} />} /><Line type="stepAfter" dataKey="meta" name="Meta de la medición" stroke="#111827" strokeDasharray="6 4" strokeWidth={2} dot={{ r: 2.5, fill: '#111827', stroke: '#111827' }} connectNulls={false} />{hasCriticalLine && <Line type="stepAfter" dataKey="critical" name="Desviación crítica" stroke="#b45309" strokeDasharray="3 5" strokeWidth={1.8} dot={false} connectNulls={false} />}{hasEqualityBounds && <><Line type="stepAfter" dataKey="criticalLower" name="Desviación crítica inferior" stroke="#b45309" strokeDasharray="3 5" strokeWidth={1.8} dot={false} connectNulls={false} /><Line type="stepAfter" dataKey="criticalUpper" name="Desviación crítica superior" stroke="#b45309" strokeDasharray="3 5" strokeWidth={1.8} dot={false} connectNulls={false} /></>}<Line type="monotone" dataKey="resultado" name="Resultado" stroke="#64748b" strokeWidth={2.5} dot={props => <ResultDot {...props} />} activeDot={props => <ResultDot {...props} />} /></LineChart></ResponsiveContainer></div>
    {selectedReports.some(row => row.measurement_target == null) && <p className="text-xs text-slate-500">Para registros sin meta guardada se usa el historial de cambios disponible o la meta actual como referencia.</p>}
  </section>;
}
