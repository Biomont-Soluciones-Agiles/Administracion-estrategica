import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Search, Star, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { displayUnit } from './lib/units';

export default function CoreIndicators({ open, onClose, indicators = [], objectives = [], coreRows = [], onReload, onNotify, onError, onSaved, title = 'Indicadores GCG', description = 'Selecciona hasta cuatro indicadores prioritarios para el seguimiento ejecutivo.', maxSelections = 4, rpcName = 'set_core_indicators' }) {
  const initial = useMemo(() => coreRows.map(row => String(row.indicator_id)), [coreRows]);
  const [selected, setSelected] = useState(initial);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setSelected(initial), [initial.join('|')]);
  useEffect(() => { if (open) setQuery(''); }, [open]);

  const toggle = id => {
    const value = String(id);
    setSelected(current => current.includes(value)
      ? current.filter(item => item !== value)
      : current.length < maxSelections ? [...current, value] : current);
  };
  const cancel = () => { setSelected(initial); onClose(); };
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc(rpcName, { selected_indicator_ids: selected.map(Number) });
    setBusy(false);
    if (error) { onError(`No se pudieron guardar los indicadores seleccionados: ${error.message}`); return; }
    onSaved?.(selected.map(Number));
    onNotify(`${title} actualizados.`);
    onClose();
    try {
      await onReload?.();
    } catch {
      // La selección ya se confirmó localmente; la próxima carga reconciliará los datos.
    }
  };
  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  const matches = indicators.filter(indicator => {
    if (!normalizedQuery) return true;
    const objective = objectives.find(item => String(item.id) === String(indicator.objectiveId));
    return [indicator.code, indicator.name, objective?.code, objective?.name]
      .filter(Boolean).some(value => String(value).toLocaleLowerCase('es').includes(normalizedQuery));
  });

  if (!open) return null;
  return createPortal(<div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 pt-20 sm:items-center sm:pt-4" role="dialog" aria-modal="true" aria-labelledby="core-indicators-title">
    <div className="flex max-h-[min(44rem,calc(100vh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 sm:p-6"><div><div className="flex items-center gap-2"><Star className="h-5 w-5 text-amber-500" fill="currentColor" /><h2 id="core-indicators-title" className="text-xl font-bold text-slate-900">{title}</h2></div><p className="mt-2 text-sm text-slate-500">{description}</p></div><button type="button" onClick={cancel} disabled={busy} aria-label="Cerrar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><X className="h-5 w-5" /></button></div>
      <div className="border-b border-slate-200 p-5 sm:px-6"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar indicadores" className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></div><p className="mt-3 text-sm font-medium text-slate-600"><span className="font-bold text-blue-700">{selected.length}/{maxSelections}</span> seleccionados</p></div>
      <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">{matches.map(indicator => { const objective = objectives.find(item => String(item.id) === String(indicator.objectiveId)); const checked = selected.includes(String(indicator.id)); return <label key={indicator.id} className={`flex cursor-pointer items-start gap-3 p-4 sm:px-6 ${checked ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}><input type="checkbox" checked={checked} onChange={() => toggle(indicator.id)} disabled={!checked && selected.length >= maxSelections} className="mt-1 h-4 w-4 accent-[#1D4ED8]" /><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">{indicator.name}</span>{checked && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">{title.replace('Indicadores ', '')}</span>}</span><span className="mt-1 block text-sm text-slate-500">{indicator.code ? `${indicator.code} · ` : ''}{objective?.name || 'Sin objetivo'} · Meta: {indicator.comparator} {indicator.target} {displayUnit(indicator.unit)}</span></span></label>; })}{!matches.length && <p className="p-8 text-center text-sm text-slate-500">No encontramos indicadores con esa búsqueda.</p>}</div>
      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 p-5 sm:flex-row sm:justify-end sm:px-6"><button type="button" onClick={cancel} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancelar</button><button type="button" disabled={busy} onClick={save} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{busy ? 'Guardando…' : 'Guardar'}</button></div>
    </div>
  </div>, document.body);
}
