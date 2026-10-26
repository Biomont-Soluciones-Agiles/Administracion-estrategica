import { displayUnit } from './lib/units';
import React, { useState } from 'react';
import { Filter, Star } from 'lucide-react';
import { AttentionPanel, IndicatorPortfolioCard, PortfolioSummary, PortfolioStatus } from './IndicatorPortfolio';
import { portfolioRows } from './lib/indicatorPortfolio';
import MeasurementChart from './MeasurementChart';
import { filterIndicators, weightedIndicatorSummary } from './lib/indicatorViews';
import { parseReportPeriod } from './lib/reporting';
import { personName } from './lib/personNames';
import { complianceMark, measurementComplianceBand } from './lib/complianceBand';
import SearchableIndicatorSelect from './SearchableIndicatorSelect';
import { AnalysisHistoryButton, ActionsHistoryButton } from './CorrectiveWorkflow';
import CoreIndicators from './CoreIndicators';

const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base';

export function IndicatorFilterMenu({ objectives, indicators, reports = [], isGcg = false, users = [], sites = [], assignments = [], filters, onChange }) {
  const statusIndicators = portfolioRows(indicators, reports).map(row => ({ ...row.indicator, status: row.status, condition: row.latest?.result == null ? 'Sin condición' : ({ pesimista: 'Pesimista', optimista: 'Optimista', excepcional: 'Excepcional' })[measurementComplianceBand(row.latest.result, row.indicator.target, row.indicator.comparator).band] || 'Sin condición' }));
  const responsibles = [...new Map(indicators.map(item => {
    const id = item.ownerId || item.owner_email || item.reporter_email || '';
    return id ? [String(id), personName(id, users)] : null;
  }).filter(Boolean))].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const apply = next => {
    const matches = filterIndicators(statusIndicators, next);
    const selectedStillMatches = matches.some(item => String(item.id) === String(next.indicatorId));
    onChange({ ...next, indicatorId: selectedStillMatches ? next.indicatorId : '' });
  };
  const change = key => event => apply({ ...filters, [key]: event.target.value });
  const matches = filterIndicators(statusIndicators, { ...filters, search: '' });
  return <details className="relative ml-auto shrink-0">
    <summary aria-label="Filtros de indicadores" title="Filtros de indicadores" className="flex cursor-pointer list-none items-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"><Filter className="h-5 w-5" /><span className="sr-only">Filtros de indicadores</span></summary>
    <div className="absolute right-0 top-full z-[60] mt-2 w-[min(92vw,48rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-slate-800">Filtros de indicadores</p>{(filters.search || filters.objectiveId || filters.responsibleId || filters.siteId || filters.status || filters.condition || filters.indicatorId) && <button type="button" className="text-sm font-medium text-blue-700" onClick={() => onChange({ search: '', objectiveId: '', responsibleId: '', siteId: '', status: '', condition: '', indicatorId: '' })}>Limpiar</button>}</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SearchableIndicatorSelect indicators={matches} value={filters.indicatorId} onChange={indicatorId => onChange({ ...filters, search: '', indicatorId })} />
        <label className="text-sm font-medium text-slate-700">Objetivo<select className={input} value={filters.objectiveId} onChange={change('objectiveId')}><option value="">Todos los objetivos</option>{objectives.map(item => <option key={item.id} value={item.id}>{item.code ? `${item.code} · ` : ''}{item.name}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Responsable<select className={input} value={filters.responsibleId} onChange={change('responsibleId')}><option value="">Todos los responsables</option>{responsibles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        {isGcg && <label className="text-sm font-medium text-slate-700">Sede<select aria-label="Filtrar por sede" className={input} value={filters.siteId || ''} onChange={change('siteId')}><option value="">Todas las sedes</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Estado<select aria-label="Estado de indicadores" className={input} value={filters.status || ''} onChange={change('status')}><option value="">Todos los estados</option>{['Fuera de meta', 'No reportado', 'En meta', 'Sin datos'].map(status => <option key={status}>{status}</option>)}</select></label><label className="block text-sm font-medium text-slate-700">Condición<select aria-label="Condición de indicadores" className={input} value={filters.condition || ''} onChange={change('condition')}><option value="">Todas las condiciones</option>{['Pesimista', 'Optimista', 'Excepcional', 'Sin condición'].map(condition => <option key={condition}>{condition}</option>)}</select></label></div>
    </div>
  </details>;
}

export function IndicatorYearFilter({ reports, year, onChange }) {
  const years = [...new Set([String(new Date().getFullYear()), ...reports.map(report => parseReportPeriod(report.period)?.year).filter(Boolean)])].sort((a, b) => Number(b) - Number(a));
  return <details className="relative ml-auto shrink-0"><summary aria-label="Filtrar indicador por año" className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"><Filter className="h-5 w-5" /></summary><div className="absolute right-0 top-full z-[60] mt-2 w-56 rounded-xl border border-slate-200 bg-white p-4 shadow-xl"><label className="block text-sm font-semibold text-slate-700">Año<select aria-label="Año del indicador" className={input} value={year} onChange={event => onChange(event.target.value)}><option value="">Todos los años</option>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label></div></details>;
}

function SimpleMeasurementHistory({ rows, indicator, objective, workflow, users, canViewWorkflow = false }) {
  const condition = row => {
    if (row.result == null) return 'Sin datos';
    const band = measurementComplianceBand(row.result, indicator.target, indicator.comparator).band;
    return ({ pesimista: 'Pesimista', optimista: 'Optimista', excepcional: 'Excepcional' })[band] || 'Sin condición';
  };
  const hasWorkflow = canViewWorkflow && workflow;
  return <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden"><div className="p-5 border-b"><h3 className="font-semibold">Historial de mediciones</h3><p className="mt-1 text-xs text-slate-500">La condición consolida el estándar de cumplimiento de cada medición.</p></div><div className="overflow-x-auto"><table className="w-full text-center text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Periodo</th><th className="p-3">Resultado</th><th className="p-3">Condición</th><th className="p-3">Estado</th>{hasWorkflow && <><th className="p-3">Análisis de causa</th><th className="p-3">Acciones</th></>}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t"><td className="p-3">{row.period}</td><td className="p-3 font-medium">{row.result == null ? 'Sin datos' : row.result + ' ' + displayUnit(indicator.unit)}</td><td className={`p-3 font-semibold ${({ Pesimista: 'text-amber-700', Optimista: 'text-green-700', Excepcional: 'text-blue-700' })[condition(row)] || 'text-slate-700'}`}>{condition(row)}</td><td className="p-3"><div className="flex justify-center"><PortfolioStatus status={row.status} /></div></td>{hasWorkflow && <><td className="p-3"><div className="flex justify-center"><AnalysisHistoryButton report={row} indicator={indicator} objective={objective} workflow={workflow} users={users} canManage={false} /></div></td><td className="p-3"><div className="flex justify-center"><ActionsHistoryButton report={row} workflow={workflow} users={users} canManage={false} /></div></td></>}</tr>)}{!rows.length && <tr><td colSpan={hasWorkflow ? 6 : 4} className="p-8 text-center text-slate-500">Sin mediciones.</td></tr>}</tbody></table></div></section>;
}

export default function BioIndicatorsView({ objectives, indicators, reports, users = [], sites = [], assignments = [], filters, onChange, year = '', isGcg = false, isGeneralManager = false, workflow, session, onReload, onError, onNotify, coreRows = [], onCoreSaved, generalManagerRows = [], onGeneralManagerSaved, featuredOnly = false, featuredTitle = 'Indicadores gerenciales' }) {
  const historyMode = 'simple';
  const [selectionMode, setSelectionMode] = useState(null);
  const [activeGroup, setActiveGroup] = useState(isGcg ? 'gcg' : isGeneralManager ? 'gg' : 'general');
  const scopedIndicatorIds = filters.siteId ? new Set(assignments.filter(assignment => String(assignment.site_id) === String(filters.siteId) && assignment.active).map(assignment => String(assignment.indicator_id))) : null;
  const availableIndicators = scopedIndicatorIds ? indicators.filter(indicator => scopedIndicatorIds.has(String(indicator.id))) : indicators;
  const generalManagerIds = new Set(generalManagerRows.map(row => String(row.indicator_id)));
  const visibleIndicators = featuredOnly ? availableIndicators.filter(indicator => generalManagerIds.has(String(indicator.id))) : availableIndicators;
  const list = filterIndicators(portfolioRows(visibleIndicators, reports).map(row => ({ ...row.indicator, status: row.status })), filters);
  const indicator = list.find(item => String(item.id) === String(filters.indicatorId));
  const objective = objectives.find(item => item.id === indicator?.objectiveId);
  const rows = reports.filter(report => report.indicatorId === indicator?.id && (!filters.siteId || assignments.some(assignment => String(assignment.id) === String(report.assignmentId) && String(assignment.site_id) === String(filters.siteId))) && (!year || parseReportPeriod(report.period)?.year === year)).sort((a, b) => (parseReportPeriod(b.period)?.order || 0) - (parseReportPeriod(a.period)?.order || 0) || Number(b.id) - Number(a.id));
  const latest = rows[0];
  const weighted = weightedIndicatorSummary(indicator, rows, year);
  const portfolio = portfolioRows(list, reports);
  const coreIds = new Set(coreRows.map(row => String(row.indicator_id)));
  const corePortfolio = isGcg && !featuredOnly ? portfolio.filter(row => coreIds.has(String(row.indicator.id))) : [];
  const generalManagerPortfolio = isGeneralManager && !featuredOnly ? portfolio.filter(row => generalManagerIds.has(String(row.indicator.id))) : [];
  const generalPortfolio = isGeneralManager && !featuredOnly
    ? portfolio.filter(row => !generalManagerIds.has(String(row.indicator.id)))
    : isGcg && !featuredOnly
      ? portfolio.filter(row => !coreIds.has(String(row.indicator.id)))
      : portfolio;
  const select = item => onChange({ ...filters, indicatorId: String(item.id) });
  return <div className="fade-in space-y-6">
    {!indicator &&     <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-medium text-slate-500">Reportería / Indicadores</p><h1 className="text-3xl font-bold tracking-tight text-slate-900 mt-2">{featuredOnly ? featuredTitle : 'Indicadores'}</h1><p className="text-sm text-slate-500 mt-2">{featuredOnly ? 'Indicadores priorizados para Gerencia General.' : 'Seguimiento integral del portafolio'}</p></div>{isGcg && !featuredOnly && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSelectionMode('gcg')} className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100"><Star className="h-4 w-4" />Indicadores GCG</button><button type="button" onClick={() => setSelectionMode('gg')} className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-800 hover:bg-violet-100"><Star className="h-4 w-4" />Indicadores GG</button></div>}</header>}
    {!indicator && <PortfolioSummary rows={portfolio} />}
    {!list.length && <p className="rounded-xl bg-white border p-8 text-center text-slate-500">No hay indicadores que coincidan con estos filtros.</p>}
    {indicator ? <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-2xl p-6 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,480px)] gap-6">
        <div><p className="text-sm text-slate-500">{objective?.code} · {objective?.name}</p><p className="text-xs font-semibold text-blue-700 mt-4">{indicator.code}</p><h2 className="text-2xl font-bold text-slate-900 mt-1">{indicator.name}</h2><p className="text-slate-500 mt-3 break-words">Fórmula: {indicator.formula || '—'}</p><p className="text-sm text-slate-500 mt-2">Frecuencia: {indicator.frequency}</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center"><p className="text-sm text-slate-500">Última medición · {latest?.period || 'Sin reporte'}</p><p className="text-4xl font-bold text-slate-900 mt-3">{latest?.status === 'Sin datos' ? 'Sin datos' : latest?.result ?? '—'} <span className="text-xl">{displayUnit(indicator.unit)}</span></p><div className="mt-3 flex justify-center"><PortfolioStatus status={latest?.status || 'Sin reporte'} /></div><p className="text-xs text-slate-500 mt-3">Meta actual: {indicator.comparator} {indicator.target} {displayUnit(indicator.unit)}</p></div>
          <div aria-label="Valor ponderado del indicador" className="rounded-xl border border-slate-200 border-t-4 border-t-blue-500 bg-white p-5 text-center shadow-sm"><p className="text-sm font-medium text-slate-500">Valor ponderado{weighted.year ? ` ${weighted.year}` : ''}</p><p className="mt-3 text-4xl font-bold text-slate-900">{weighted.display} <span className="text-xl font-normal text-slate-500">{weighted.value !== null ? displayUnit(indicator.unit) : ''}</span></p>{weighted.status && <div className="mt-3 flex justify-center"><PortfolioStatus status={weighted.status} /></div>}<p className="mt-3 text-xs text-slate-400">{weighted.count ? `${weighted.count} medición${weighted.count === 1 ? '' : 'es'}` : 'Sin mediciones con datos'}</p></div>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6"><MeasurementChart indicator={indicator} reports={reports.filter(report => String(report.indicatorId) === String(indicator.id))} year={year} showYearFilter={false} /></section>
      
      {historyMode === 'detail' && <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden"><h3 className="p-5 border-b font-semibold">Historial de mediciones</h3><div className="overflow-x-auto"><table className="w-full table-fixed text-center text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="w-[14%] p-3 text-center">Periodo</th><th className="w-[14%] p-3 text-center">Resultado</th><th className="w-[12%] p-3 text-center">Pesimista</th><th className="w-[12%] p-3 text-center">Optimista</th><th className="w-[12%] p-3 text-center">Excepcional</th><th className="w-[14%] p-3 text-center">Estado</th>{isGcg && workflow && <><th className="w-[11%] p-3 text-center">Análisis de causa</th><th className="w-[7%] p-3 text-center">Acciones</th></>}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t"><td className="p-3">{row.period}</td><td className="p-3 font-medium">{row.result == null ? 'Sin datos' : row.result + ' ' + displayUnit(indicator.unit)}</td><td className="p-3 font-bold text-amber-700">{complianceMark(row.result, indicator.target, indicator.comparator, 'pesimista')}</td><td className="p-3 font-bold text-green-700">{complianceMark(row.result, indicator.target, indicator.comparator, 'optimista')}</td><td className="p-3 font-bold text-blue-700">{complianceMark(row.result, indicator.target, indicator.comparator, 'excepcional')}</td><td className="p-3"><div className="flex justify-center"><PortfolioStatus status={row.status} /></div></td>{isGcg && workflow && <><td className="p-3"><div className="flex justify-center"><AnalysisHistoryButton report={row} indicator={indicator} objective={objective} workflow={workflow} users={users} canManage={false} /></div></td><td className="p-3"><div className="flex justify-center"><ActionsHistoryButton report={row} workflow={workflow} users={users} canManage={false} /></div></td></>}</tr>)}{!rows.length && <tr><td colSpan={isGcg && workflow ? 8 : 6} className="p-8 text-center text-slate-500">Sin mediciones.</td></tr>}</tbody></table></div></section>}
      {historyMode === 'simple' && <SimpleMeasurementHistory rows={rows} indicator={indicator} objective={objective} workflow={workflow} users={users} canViewWorkflow={isGcg || isGeneralManager} />}
    </div> : list.length > 0 && <div className="space-y-5">
      {!featuredOnly && (isGcg || isGeneralManager) && <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3">
        {isGcg && <button type="button" onClick={() => setActiveGroup('gcg')} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeGroup === 'gcg' ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}><Star className="h-4 w-4" fill={activeGroup === 'gcg' ? 'currentColor' : 'none'} />Indicadores GCG</button>}
        {isGeneralManager && <button type="button" onClick={() => setActiveGroup('gg')} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeGroup === 'gg' ? 'bg-violet-100 text-violet-800 ring-1 ring-violet-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}><Star className="h-4 w-4" fill={activeGroup === 'gg' ? 'currentColor' : 'none'} />Indicadores GG</button>}
        <button type="button" onClick={() => setActiveGroup('general')} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeGroup === 'general' ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}><Filter className="h-4 w-4" />Indicadores generales</button>
      </div>}
      {activeGroup === 'gcg' && isGcg && <section>{corePortfolio.length ? <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{corePortfolio.map(row => <IndicatorPortfolioCard key={row.indicator.id} row={row} objective={objectives.find(item => item.id === row.indicator.objectiveId)} users={users} onSelect={select} />)}</div> : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">Aún no has seleccionado indicadores GCG.</p>}</section>}
      {activeGroup === 'gg' && isGeneralManager && <section>{generalManagerPortfolio.length ? <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{generalManagerPortfolio.map(row => <IndicatorPortfolioCard key={row.indicator.id} row={row} objective={objectives.find(item => item.id === row.indicator.objectiveId)} users={users} onSelect={select} />)}</div> : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">Aún no tienes indicadores seleccionados para Gerencia General.</p>}</section>}
      {activeGroup === 'general' && <section><div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_290px]"><div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{generalPortfolio.map(row => <IndicatorPortfolioCard key={row.indicator.id} row={row} objective={objectives.find(item => item.id === row.indicator.objectiveId)} users={users} onSelect={select} />)}{!generalPortfolio.length && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">No hay más indicadores para mostrar.</p>}</div><AttentionPanel rows={portfolio} objectives={objectives} onSelect={select} /></div></section>}
    </div>}
    <CoreIndicators open={Boolean(selectionMode)} onClose={() => setSelectionMode(null)} indicators={indicators} objectives={objectives} coreRows={selectionMode === 'gg' ? generalManagerRows : coreRows} onReload={onReload} onError={onError} onNotify={onNotify} title={selectionMode === 'gg' ? 'Indicadores GG' : 'Indicadores GCG'} description="Selecciona libremente los indicadores que se mostrarán en esta sección." maxSelections={null} rpcName={selectionMode === 'gg' ? 'set_general_manager_indicators' : 'set_core_indicators'} onSaved={ids => (selectionMode === 'gg' ? onGeneralManagerSaved?.(ids) : onCoreSaved?.(ids))} />
  </div>;
}
