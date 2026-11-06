import React, { useState } from 'react';
import { BarChart3, LogOut } from 'lucide-react';
import MeasurementChart from './MeasurementChart';
import { accountIdentities, supportIndicators } from './lib/responsibility';
import { MONTHS, parseReportPeriod } from './lib/reporting';
import { displayUnit } from './lib/units';
import { supabase } from './lib/supabase';
import biomontLogo from './assets/biomont-logo.png';
import kunturLogo from './assets/kuntur-pharma-logo.png';

const normalize = value => String(value || '').trim().toLowerCase();
export default function UserWorkspace({ session, objectives, indicators, reports, users, organizationPeople, sites = [], assignments = [], reportingSupports = [], onReload, onSignOut }) {
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ period: '', result: '', observations: '', noData: false, assignmentId: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isKunturAccount = /@kunturpharma\.pe$/i.test(session?.user?.email || '');
  const identities = accountIdentities(session.user.email, organizationPeople);
  const owns = value => identities.some(identity => normalize(identity) === normalize(value));
  const delegatedAssignmentIds = new Set(reportingSupports
    .filter(support => support.active && owns(support.support_email))
    .map(support => String(support.site_assignment_id)));
  const reportableAssignments = assignments.filter(assignment => assignment.active && (
    owns(assignment.responsible_email) || delegatedAssignmentIds.has(String(assignment.id))
  ));
  const reportableAssignmentIds = new Set(reportableAssignments.map(assignment => String(assignment.id)));
  const legacyAssigned = supportIndicators(indicators, identities);
  const assigned = indicators.filter(indicator => legacyAssigned.some(item => String(item.id) === String(indicator.id))
    || reportableAssignments.some(assignment => String(assignment.indicator_id) === String(indicator.id)));
  const selected = assigned.find(indicator => String(indicator.id) === String(selectedId));
  const selectedAssignments = selected ? reportableAssignments.filter(assignment => String(assignment.indicator_id) === String(selected.id)) : [];
  const history = selected ? reports.filter(report => String(report.indicatorId) === String(selected.id)
    && (!report.assignmentId || reportableAssignmentIds.has(String(report.assignmentId))))
    .sort((a, b) => (parseReportPeriod(a.period)?.order || 0) - (parseReportPeriod(b.period)?.order || 0)) : [];
  const openIndicator = indicator => {
    if (!assigned.some(item => String(item.id) === String(indicator.id))) return;
    setSelectedId(indicator.id); setError(''); setNotice('');
    const indicatorAssignments = reportableAssignments.filter(assignment => String(assignment.indicator_id) === String(indicator.id));
    setForm({ period: '', result: '', observations: '', noData: false, assignmentId: indicatorAssignments[0] ? String(indicatorAssignments[0].id) : '' });
  };
  const save = async event => {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const [year, month] = form.period.split('-');
      const result = form.noData ? null : Number(form.result);
      if (!/^\d{4}-\d{2}$/.test(form.period) || !MONTHS[Number(month) - 1] || (!form.noData && (!form.result.trim() || !Number.isFinite(result)))) throw new Error('Completa el periodo y el resultado.');
      const payload = {
        indicator: selected.id,
        report_period: MONTHS[Number(month) - 1] + ',' + year,
        report_result: result,
        report_observations: form.noData ? null : form.observations.trim() || null,
      };
      const { error: failure } = form.assignmentId
        ? await supabase.rpc('register_site_indicator_measurement', { ...payload, assignment: Number(form.assignmentId) })
        : await supabase.rpc('register_indicator_measurement', payload);
      if (failure) throw failure;
      await onReload();
      setForm({ period: '', result: '', observations: '', noData: false, assignmentId: selectedAssignments[0] ? String(selectedAssignments[0].id) : '' });
      setNotice('Medición registrada.');
    } catch (failure) { setError(failure.message || 'No se pudo registrar la medición.'); }
    finally { setBusy(false); }
  };
  const tabs = <button type="button" onClick={() => { setSelectedId(null); setError(''); }} className="flex items-center gap-3 rounded-lg bg-slate-700 px-3 py-3 text-sm font-semibold text-white"><BarChart3 className="h-5 w-5" />Indicadores</button>;
  return <div className="biomet-app flex min-h-screen bg-slate-50 text-slate-900"><aside className="app-sidebar fixed hidden h-full flex-col bg-slate-900 md:flex"><div className="flex h-14 items-center gap-2 border-b border-slate-800 px-4"><img src={isKunturAccount ? kunturLogo : biomontLogo} alt={isKunturAccount ? "Kuntur Pharma" : "Biomont"} className={`h-9 ${isKunturAccount ? "w-28" : "w-12"} object-contain`} /><strong className="text-lg text-white">Gestión Estratégica</strong></div><nav className="flex flex-1 flex-col gap-1 p-3">{tabs}</nav><footer className="border-t border-slate-800 p-4 text-xs text-slate-400"><p className="truncate text-sm text-white">{session.user.user_metadata?.full_name || session.user.email}</p><p className="mt-1">Usuario</p><button onClick={onSignOut} className="mt-3 flex items-center gap-2 text-slate-300"><LogOut className="h-4 w-4" />Cerrar sesión</button></footer></aside><main className="app-main min-w-0 flex-1 p-4 md:p-6"><header className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900 p-2 md:hidden"><nav className="flex gap-2">{tabs}</nav><button onClick={onSignOut} aria-label="Cerrar sesión" className="p-2 text-white"><LogOut className="h-5 w-5" /></button></header>
    <div className="space-y-5"><header><h1 className="text-3xl font-bold">Indicadores</h1><p className="mt-2 text-sm text-slate-500">Indicadores donde tienes una asignación para registrar mediciones.</p></header>{selected ? <><button onClick={() => setSelectedId(null)} className="text-sm font-semibold text-blue-700">← Volver a indicadores</button><section className="rounded-xl border bg-white p-5"><p className="text-xs font-semibold text-blue-700">{selected.code}</p><h2 className="mt-1 text-xl font-bold">{selected.name}</h2><p className="mt-2 text-sm text-slate-500">{objectives.find(item => item.id === selected.objectiveId)?.name}</p><p className="mt-3 text-sm">Meta: {selected.comparator} {selected.target} {displayUnit(selected.unit)} · {selected.frequency}</p></section><section className="rounded-xl border bg-white p-5"><MeasurementChart indicator={selected} reports={history} /></section><form onSubmit={save} className="space-y-4 rounded-xl border bg-white p-5"><h3 className="font-semibold">Registrar medición</h3>{selectedAssignments.length > 0 && <label className="block text-sm">Sede<select required value={form.assignmentId} onChange={event => setForm({ ...form, assignmentId: event.target.value })} className="mt-1 block w-full rounded-lg border p-2">{selectedAssignments.map(assignment => <option key={assignment.id} value={assignment.id}>{sites.find(site => String(site.id) === String(assignment.site_id))?.name || 'Sede asignada'}</option>)}</select></label>}<div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Periodo<input required type="month" value={form.period} onChange={event => setForm({ ...form, period: event.target.value })} className="mt-1 block w-full rounded-lg border p-2" /></label>{!form.noData && <label className="text-sm">Resultado {displayUnit(selected.unit)}<input required type="number" step="any" value={form.result} onChange={event => setForm({ ...form, result: event.target.value })} className="mt-1 block w-full rounded-lg border p-2" /></label>}</div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.noData} onChange={event => setForm({ ...form, noData: event.target.checked })} />Sin datos para este periodo</label>{!form.noData && <label className="block text-sm">Observaciones (opcional)<textarea value={form.observations} onChange={event => setForm({ ...form, observations: event.target.value })} className="mt-1 block w-full rounded-lg border p-2" /></label>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{notice && <p role="status" className="text-sm text-green-700">{notice}</p>}<button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar medición'}</button></form><section className="overflow-x-auto rounded-xl border bg-white p-5"><h3 className="mb-3 font-semibold">Historial de mediciones</h3><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-2">Periodo</th><th>Resultado</th><th>Estado</th></tr></thead><tbody>{[...history].reverse().map(report => <tr key={report.id} className="border-b"><td className="py-3">{report.period}</td><td>{report.result == null ? 'Sin datos' : report.result + ' ' + displayUnit(selected.unit)}</td><td>{report.status}</td></tr>)}</tbody></table>{!history.length && <p className="py-4 text-sm text-slate-500">Aún no hay mediciones.</p>}</section></> : <><input aria-label="Buscar indicador" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nombre o código" className="w-full max-w-lg rounded-lg border bg-white p-3 text-sm" /><div className="divide-y rounded-xl border bg-white">{assigned.filter(item => normalize(item.code + ' ' + item.name).includes(normalize(search))).map(indicator => <button key={indicator.id} onClick={() => openIndicator(indicator)} className="block w-full p-5 text-left hover:bg-slate-50"><p className="text-xs text-blue-700">{indicator.code}</p><h2 className="mt-1 font-semibold">{indicator.name}</h2><p className="mt-1 text-sm text-slate-500">Meta: {indicator.comparator} {indicator.target} {displayUnit(indicator.unit)}</p></button>)}{!assigned.length && <p className="p-8 text-sm text-slate-500">No tienes indicadores asignados.</p>}</div></>}</div>
  </main></div>;
}
