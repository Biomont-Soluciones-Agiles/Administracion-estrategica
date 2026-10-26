import { displayUnit } from './lib/units';
import React, { useEffect, useId, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Area, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { measurementSeries, measurementTicks } from './lib/indicatorViews';
import { deviationAssessment } from './lib/measurementDeviation';
import { comparisonKey, historicalComparisonSeries } from './lib/historicalComparison';
import { parseReportPeriod } from './lib/reporting';
import { supabase } from './lib/supabase';
import { measurementComplianceBand } from './lib/complianceBand';

const NAVY = '#112B50';
const COMPARISON_COLORS = ['#112B50', '#5B8FF9', '#16A34A', '#D97706', '#7C3AED', '#E11D48'];
const formatValue = value => Number(value).toLocaleString('es-PE', { maximumFractionDigits: 4 });
const valueWithUnit = (value, unit) => value == null ? 'Sin medición' : `${formatValue(value)} ${unit}`.trim();

function MeasurementTooltip({ active, payload, label, unit, defaultComparator, comparison, comparisonYears }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  if (comparison) return <div className="min-w-52 rounded-xl border border-slate-200 bg-white p-3.5 text-sm shadow-xl">
    <p className="mb-3 font-semibold text-slate-900">{row.monthName}</p>
    {comparisonYears.map((year, index) => <p key={year} className="mt-2 flex items-center justify-between gap-6">
      <span className="flex items-center gap-2 text-slate-600"><i className="h-2 w-2 rounded-full" style={{ background: COMPARISON_COLORS[index % COMPARISON_COLORS.length] }} />{year}</span>
      <strong style={{ color: COMPARISON_COLORS[index % COMPARISON_COLORS.length] }}>{valueWithUnit(row[comparisonKey(year)], unit)}</strong>
    </p>)}
  </div>;
  if (row.resultado == null) return null;
  const assessment = deviationAssessment(row.resultado, row.meta, row.comparator || defaultComparator);
  const inTarget = assessment.status === 'en_meta';
  const moderate = assessment.status === 'desviacion_moderada';
  return <div className="min-w-56 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl">
    <p className="font-semibold text-slate-900">{label}</p>
    <div className="mt-3 space-y-2 text-sm">
      <p className="flex justify-between gap-5 text-slate-600"><span>Meta de la medición</span><strong className="text-slate-900">{row.comparator || defaultComparator} {valueWithUnit(row.meta, unit)}</strong></p>
      <p className="flex justify-between gap-5 text-slate-600"><span>Resultado</span><strong style={{ color: NAVY }}>{valueWithUnit(row.resultado, unit)}</strong></p>
      <p className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${inTarget ? 'bg-green-50 text-green-700' : moderate ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{inTarget ? 'En meta' : moderate ? 'Desviación ≤ 20%' : 'Desviación crítica'}</p>
    </div>
  </div>;
}

function MeasurementDot({ cx, cy, payload, indicator }) {
  if (payload?.resultado == null || !Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const status = deviationAssessment(payload.resultado, payload.meta ?? indicator.target, payload.comparator || indicator.comparator).status;
  const color = status === 'en_meta' ? '#16a34a' : status === 'desviacion_moderada' ? '#f59e0b' : '#dc2626';
  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#ffffff" strokeWidth={2} />;
}

function EndLabel({ x, y, index, lastIndex, text, color, offset = -10 }) {
  if (index !== lastIndex || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return <text x={x + 12} y={y + offset} fill={color} fontSize={12} fontWeight={600}>{text}</text>;
}

function ValueLabel({ x, y, value, unit, color = NAVY, offset = -14 }) {
  if (value == null || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return <text className="hidden sm:block" x={x} y={y + offset} textAnchor="middle" fill={color} fontSize={11} fontWeight={600}>{valueWithUnit(value, unit)}</text>;
}

export default function MeasurementChart({ indicator, reports, year: controlledYear, showYearFilter = true, headerAction, onComparisonChange }) {
  const calendarYear = String(new Date().getFullYear());
  const [localYear, setYear] = useState(calendarYear);
  const [comparison, setComparison] = useState(false);
  const [comparisonYears, setComparisonYears] = useState([]);
  const [history, setHistory] = useState([]);
  const year = controlledYear == null ? localYear : String(controlledYear);
  const gradientId = `measurement-area-${useId().replace(/:/g, '')}`;
  const yearInputId = `measurement-year-${useId().replace(/:/g, '')}`;
  const years = useMemo(() => [...new Set([calendarYear, ...reports.map(report => parseReportPeriod(report.period)?.year).filter(Boolean)])].sort((a, b) => Number(b) - Number(a)), [reports, calendarYear]);
  const selectedComparisonYears = comparisonYears.filter(value => years.includes(value));
  const activeComparisonYears = selectedComparisonYears.length >= 2 ? selectedComparisonYears : years.slice(0, 2);

  useEffect(() => { setComparison(false); setComparisonYears([]); }, [indicator.id]);
  useEffect(() => { onComparisonChange?.(comparison); }, [comparison, onComparisonChange]);
  useEffect(() => {
    let active = true;
    setHistory([]);
    if (!supabase) return () => { active = false; };
    supabase.from('indicator_target_history').select('*').eq('indicator_id', indicator.id).order('created_at')
      .then(({ data }) => { if (active) setHistory(data || []); });
    return () => { active = false; };
  }, [indicator.id]);

  const selectedReports = year ? reports.filter(report => parseReportPeriod(report.period)?.year === year) : reports;
  const resolvedReports = selectedReports.map(report => {
    const recordedAt = report.created_at || report.registered_date || report.date;
    const nextChange = report.measurement_target == null && recordedAt && history.find(change => new Date(change.created_at) > new Date(recordedAt));
    return { ...report, measurement_target: report.measurement_target ?? (nextChange ? nextChange.target : indicator.target), measurement_comparator: report.measurement_comparator || (nextChange && nextChange.comparator) || indicator.comparator };
  });
  const trendData = measurementSeries(resolvedReports).map(row => ({ ...row, ...deviationAssessment(row.resultado, row.meta, row.comparator) }));
  const comparisonData = historicalComparisonSeries(reports, activeComparisonYears);
  const data = comparison ? comparisonData : trendData;
  const comparisonValueRows = comparisonData.flatMap(row => activeComparisonYears.map(selectedYear => ({ resultado: row[comparisonKey(selectedYear)] })));
  const hasData = comparison
    ? comparisonData.some(row => activeComparisonYears.some(selectedYear => row[comparisonKey(selectedYear)] != null))
    : trendData.some(row => row.resultado != null);
  const ticks = measurementTicks(comparison ? comparisonValueRows : data, comparison ? 0 : indicator.target);
  const lastTargetIndex = data.findLastIndex(row => row.meta != null);
  const lastIndexes = Object.fromEntries(activeComparisonYears.map(selectedYear => [selectedYear, comparisonData.findLastIndex(row => row[comparisonKey(selectedYear)] != null)]));
  const unit = displayUnit(indicator.unit);
  const controlStyle = 'rounded-lg border border-slate-200 bg-white min-w-36 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50';

  const comparisonCellClass = value => {
    if (value == null) return 'bg-slate-50 text-slate-400';
    const band = measurementComplianceBand(value, indicator.target, indicator.comparator).band;
    return ({ pesimista: 'bg-amber-50 text-amber-800', optimista: 'bg-green-50 text-green-800', excepcional: 'bg-blue-50 text-blue-800' })[band] || 'bg-slate-50 text-slate-700';
  };

  const toggleComparison = () => {
    if (!comparison && selectedComparisonYears.length < 2) setComparisonYears(years.slice(0, 2));
    setComparison(value => !value);
  };
  const toggleYear = selectedYear => {
    setComparisonYears(current => {
      const active = current.length >= 2 ? current : years.slice(0, 2);
      if (active.includes(selectedYear)) return active.length <= 2 ? active : active.filter(value => value !== selectedYear);
      return [...active, selectedYear];
    });
  };

  return <section aria-label={`Gráfica de medición de ${indicator.name}`}>
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold text-slate-900">{comparison ? 'Gráfica comparativa' : (`Tendencia histórica${year ? ` · ${year}` : ''}`)}</h3>
      <div className="flex flex-wrap items-center gap-2">
        {showYearFilter && !comparison && <select id={yearInputId} aria-label="Año de tendencia histórica" value={year} onChange={event => setYear(event.target.value)} className={controlStyle}>{years.map(value => <option key={value} value={value}>{value}</option>)}<option value="">Todos los años</option></select>}
        {comparison && <details className="relative">
          <summary className={`${controlStyle} flex cursor-pointer list-none items-center justify-between gap-3`}>Años seleccionados ({activeComparisonYears.length})</summary>
          <div className="absolute right-0 top-full z-30 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Selecciona dos o más años</p>
            <div className="space-y-1">{years.map(value => <label key={value} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={activeComparisonYears.includes(value)} onChange={() => toggleYear(value)} className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500" />{value}</label>)}</div>
          </div>
        </details>}
        <button type="button" aria-pressed={comparison} onClick={toggleComparison} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${comparison ? 'border-blue-700 bg-blue-700 text-white hover:bg-blue-800' : 'border-slate-200 bg-white text-blue-700 hover:border-blue-300 hover:bg-blue-50'}`}><BarChart3 className="h-4 w-4" />Comparativa</button>
        {headerAction}
      </div>
    </header>

    {!hasData ? <p className="rounded-xl border border-slate-100 bg-slate-50 py-16 text-center text-sm text-slate-500">{comparison ? 'Sin mediciones registradas para los años seleccionados.' : year ? `Sin mediciones registradas en ${year}.` : 'Sin mediciones registradas.'}</p> : <>
      <div className="h-[23rem] rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/60 to-white p-2 sm:p-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 36, right: comparison ? 32 : 116, left: 0, bottom: 42 }} accessibilityLayer>
            <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#315c8c" stopOpacity={0.42} /><stop offset="100%" stopColor="#315c8c" stopOpacity={0.08} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="period" padding={{ left: 18, right: 12 }} tickMargin={12} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
            <YAxis ticks={ticks} interval={0} domain={[ticks[0], ticks[ticks.length - 1]]} width={60} tickMargin={8} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={value => `${formatValue(value)}${unit === '%' ? '%' : ''}`} axisLine={false} tickLine={false} />
            <Tooltip filterNull={false} cursor={{ stroke: '#94a3b8', strokeWidth: 1 }} content={<MeasurementTooltip unit={unit} defaultComparator={indicator.comparator} comparison={comparison} comparisonYears={activeComparisonYears} />} />
            {comparison ? activeComparisonYears.map((selectedYear, index) => <Line key={selectedYear} type="linear" dataKey={comparisonKey(selectedYear)} name={selectedYear} stroke={COMPARISON_COLORS[index % COMPARISON_COLORS.length]} strokeWidth={index === 0 ? 2.6 : 2.1} dot={{ r: 4, fill: COMPARISON_COLORS[index % COMPARISON_COLORS.length], stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 5, fill: COMPARISON_COLORS[index % COMPARISON_COLORS.length] }} connectNulls={false} isAnimationActive={false}>
            </Line>) : <>
              <Area type="linear" dataKey="resultado" name="Medición" stroke={NAVY} strokeWidth={2.5} fill={`url(#${gradientId})`} baseValue={0} dot={props => <MeasurementDot {...props} indicator={indicator} />} activeDot={props => <MeasurementDot {...props} indicator={indicator} />} connectNulls={false} isAnimationActive={false}>
                <LabelList dataKey="resultado" content={props => <ValueLabel {...props} unit={unit} />} />
              </Area>
              <Line type="stepAfter" dataKey="meta" name="Meta" stroke={NAVY} strokeDasharray="6 4" strokeWidth={1.6} dot={false} connectNulls={false} isAnimationActive={false}>
                <LabelList dataKey="meta" content={props => <EndLabel {...props} lastIndex={lastTargetIndex} text={`Meta · ${valueWithUnit(data[lastTargetIndex]?.meta, unit)}`} color={NAVY} />} />
              </Line>
            </>}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {comparison ? <><div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-600">{activeComparisonYears.map((selectedYear, index) => <span key={selectedYear} className="flex items-center gap-2"><i className="h-0.5 w-5" style={{ background: COMPARISON_COLORS[index % COMPARISON_COLORS.length] }} />{selectedYear}</span>)}</div>
        <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3"><h4 className="font-semibold text-slate-900">Comparativa mensual</h4><p className="mt-0.5 text-xs text-slate-500">Valores por mes y año seleccionado.</p></div>
          <div className="overflow-x-auto"><table className="min-w-[940px] w-full text-center text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 text-left font-semibold">Año</th>{comparisonData.map(row => <th key={row.period} className="px-3 py-3 font-semibold">{row.period}</th>)}</tr></thead><tbody>{activeComparisonYears.map((selectedYear, index) => <tr key={selectedYear} className="border-t border-slate-100"><th scope="row" className="whitespace-nowrap px-4 py-3 text-left font-semibold text-slate-800"><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: COMPARISON_COLORS[index % COMPARISON_COLORS.length] }} />{selectedYear}</span></th>{comparisonData.map(row => { const value = row[comparisonKey(selectedYear)]; return <td key={row.period} className="px-1 py-1"><span className={'block rounded-md px-2 py-2 font-medium ' + comparisonCellClass(value)}>{value == null ? '—' : valueWithUnit(value, unit)}</span></td>; })}</tr>)}</tbody></table></div>
        </section>
      </> : <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-600"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: NAVY }} />Medición</span><span className="flex items-center gap-2"><i className="h-0.5 w-5 border-t-2 border-dashed" style={{ borderColor: NAVY }} />Meta</span></div>}
    </>}
  </section>;
}
