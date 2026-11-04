import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Upload, X } from 'lucide-react';

const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/');

const HEADERS = {
  objectiveName: ['objetivo estrategico', 'nombre del objetivo'],
  description: ['descripcion'],
  focus: ['foco', 'foco estrategico'],
  responsibleManagement: ['responsable', 'gerencia responsable'],
  indicatorName: ['indicador', 'nombre del indicador'],
  formula: ['formula'],
  target: ['meta'],
};

const MANAGEMENT_ALIASES = {
  gaf: 'Administración y Finanzas',
  'administracion y finanzas': 'Administración y Finanzas',
  'gte comercial': 'Central Comercial',
  'central comercial': 'Central Comercial',
  'sg mktg': 'Subgerencia de Marketing',
  'subgerencia de marketing': 'Subgerencia de Marketing',
  'gte cx': 'Gerencia de Customer Experience',
  'gerencia de customer experience': 'Gerencia de Customer Experience',
  'j oficina proyectos': 'Jefatura de la Oficina de Proyectos',
  'jefatura de la oficina de proyectos': 'Jefatura de la Oficina de Proyectos',
  'gte supply chain': 'Supply Chain',
  'supply chain': 'Supply Chain',
  'gte op y planta': 'Operaciones y Planta',
  'operaciones y planta': 'Operaciones y Planta',
  'gte ti': 'Tecnología de la Información',
  'tecnologia de la informacion': 'Tecnología de la Información',
  gh: 'Gestión Humana', 'gte gh': 'Gestión Humana',
  'gestion humana': 'Gestión Humana',
};

function normalizeTargetAndUnit(target, indicatorName, formula) {
  if (target === null) return { target: null, unit: '%' };
  const text = `${indicatorName} ${formula}`.toLowerCase();
  if (/endeudamiento|ebitda/.test(text)) return { target, unit: 'Ratio' };
  return { target: target >= 0 && target <= 1 ? Number((target * 100).toFixed(6)) : target, unit: '%' };
}

const FOCUS_ALIASES = {
  financiero: 'Financiero', cliente: 'Cliente', procesos: 'Procesos',
  'personas/aprendizaje': 'Personas/Aprendizaje', 'personas y aprendizaje': 'Personas/Aprendizaje',
};

function parseTarget(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value ?? '').trim().replace('%', '').replace(/\s/g, '');
  if (!text) return null;
  const normalized = text.includes(',') && !text.includes('.') ? text.replace(',', '.') : text.replace(/,/g, '');
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

function locateHeader(matrix) {
  for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 30); rowIndex += 1) {
    const row = matrix[rowIndex].map(normalize);
    const indexes = Object.fromEntries(Object.entries(HEADERS).map(([field, aliases]) => [field, row.findIndex(cell => aliases.includes(cell))]));
    if ([indexes.objectiveName, indexes.focus, indexes.responsibleManagement, indexes.indicatorName, indexes.target].every(index => index >= 0)) return { rowIndex, indexes };
  }
  return null;
}

export default function BulkImport({ onImported, onError, notify }) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const reset = () => { setFileName(''); setRows([]); setErrors([]); if (inputRef.current) inputRef.current.value = ''; };
  const close = () => { if (!busy) { reset(); setOpen(false); } };

  const readFile = async event => {
    const file = event.target.files?.[0];
    reset();
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) { setErrors(['Selecciona un archivo Excel (.xlsx, .xls) o CSV.']); return; }
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
      const header = locateHeader(matrix);
      if (!header) { setErrors(['No se encontraron las columnas obligatorias: Objetivo estratégico, Foco, Responsable, Indicador y Meta.']); return; }
      const imported = [];
      const invalid = [];
      const previous = { objectiveName: '', focus: '', responsibleManagement: '' };
      matrix.slice(header.rowIndex + 1).forEach((source, offset) => {
        const value = field => header.indexes[field] >= 0 ? source[header.indexes[field]] : '';
        const objectiveCell = String(value('objectiveName') ?? '').trim();
        const focusCell = String(value('focus') ?? '').trim();
        const responsibleCell = String(value('responsibleManagement') ?? '').trim();
        if (objectiveCell) previous.objectiveName = objectiveCell;
        if (focusCell) previous.focus = focusCell;
        if (responsibleCell) previous.responsibleManagement = responsibleCell;
        const rawObjective = previous.objectiveName;
        const rawIndicator = String(value('indicatorName') ?? '').trim();
        if (!rawIndicator) return;
        const management = MANAGEMENT_ALIASES[normalize(previous.responsibleManagement)] || previous.responsibleManagement;
        const focus = FOCUS_ALIASES[normalize(previous.focus)] || previous.focus;
        const target = parseTarget(value('target'));
        const line = header.rowIndex + offset + 2;
        if (!rawObjective || !management || !focus) { invalid.push(`Fila ${line}: no se importará porque falta Objetivo, Foco o Responsable.`); return; }
        if (!FOCUS_ALIASES[normalize(focus)]) { invalid.push(`Fila ${line}: el foco “${focus}” no es válido.`); return; }
        const formula = String(value('formula') ?? '').trim();
        imported.push({ objective_name: rawObjective, description: String(value('description') ?? '').trim(), focus, responsible_management: management, indicator_name: rawIndicator, formula, ...normalizeTargetAndUnit(target, rawIndicator, formula) });
      });
      if (imported.length > 500) invalid.push('El archivo contiene más de 500 filas. Divide la carga en archivos más pequeños.');
      const pendingTargets = imported.filter(row => row.target === null).length;
      setFileName(pendingTargets ? `${file.name} · ${pendingTargets} indicador(es) con meta pendiente` : file.name); setRows(imported.slice(0, 500)); setErrors([]);
    } catch {
      setErrors(['No se pudo leer el archivo. Verifica que no esté dañado y vuelve a intentarlo.']);
    }
  };

  const submit = async () => {
    if (!rows.length || errors.length || busy) return;
    setBusy(true);
    const { data, error } = await onImported(rows);
    setBusy(false);
    if (error) { setErrors([error]); return; }
    notify(`Carga completada: ${data.created_objectives} objetivo(s) y ${data.created_indicators} indicador(es) creados.`);
    close();
  };

  return <><button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"><Upload className="h-4 w-4" />Carga masiva</button>{open && createPortal(<div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Carga masiva de objetivos e indicadores"><section className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5"><div><h2 className="text-xl font-bold text-slate-900">Carga masiva</h2><p className="mt-1 text-sm text-slate-500">Crea objetivos e indicadores desde la primera hoja del archivo.</p></div><button type="button" aria-label="Cerrar" onClick={close} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header><div className="space-y-5 p-6"><div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950"><p className="font-semibold">Columnas reconocidas</p><p className="mt-1 leading-6">Objetivo estratégico, Descripción, Foco, Responsable, Indicador, Fórmula y Meta.</p><p className="mt-1 leading-6">La vigencia será 2025–2027, el comparador será ≥, la frecuencia mensual y la unidad %.</p></div><label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-6 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50"><FileSpreadsheet className="h-9 w-9 text-blue-700" /><span className="mt-3 text-sm font-semibold text-slate-800">Seleccionar archivo Excel</span><span className="mt-1 text-xs text-slate-500">.xlsx, .xls o .csv</span><input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={readFile} className="sr-only" /></label>{fileName && <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"><p className="font-medium text-slate-800">{fileName}</p><p className="mt-1 text-slate-600">{rows.length} fila(s) listas para importar.</p></div>}{errors.length > 0 && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Revisa el archivo antes de importar</p><ul className="mt-2 list-disc space-y-1 pl-5">{errors.slice(0, 6).map(error => <li key={error}>{error}</li>)}</ul>{errors.length > 6 && <p className="mt-2">Y {errors.length - 6} observación(es) más.</p>}</div>}{rows.length > 0 && !errors.length && <div className="max-h-48 overflow-auto rounded-xl border border-slate-200"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-600"><tr><th className="px-3 py-2">Objetivo</th><th className="px-3 py-2">Indicador</th><th className="px-3 py-2">Meta</th></tr></thead><tbody>{rows.slice(0, 10).map((row, index) => <tr key={`${row.objective_name}-${row.indicator_name}-${index}`} className="border-t border-slate-100"><td className="px-3 py-2">{row.objective_name}</td><td className="px-3 py-2">{row.indicator_name}</td><td className="px-3 py-2">≥ {row.target} %</td></tr>)}</tbody></table></div>}</div><footer className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4"><button type="button" onClick={close} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancelar</button><button type="button" disabled={!rows.length || errors.length || busy} onClick={submit} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Creando…' : 'Crear objetivos e indicadores'}</button></footer></section></div>, document.body)}</>;
}
