export function rankedObjectives(objectives) {
  return objectives.map(objective => ({ ...objective, progress: Number.isFinite(Number(objective.progress)) ? Math.min(100, Math.max(0, Number(objective.progress))) : 0 })).sort((a, b) => b.progress - a.progress);
}

export function linkedProjectProgress(projects = []) {
  if (!projects.length) return 0;
  const total = projects.reduce((sum, project) => {
    const progress = Number(project.progress);
    return sum + (Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0);
  }, 0);
  return Math.round(total / projects.length);
}

export function withLinkedProjectProgress(objectives = [], projects = []) {
  return objectives.map(objective => ({
    ...objective,
    progress: linkedProjectProgress(projects.filter(project => String(project.objectiveId ?? project.objective_id) === String(objective.id))),
  }));
}

export function objectiveActivityStatus(objective, now = new Date()) {
  if (['Activo', 'No activo'].includes(objective.status)) return objective.status;
  const year = Number(new Intl.DateTimeFormat('en', { timeZone: 'America/Lima', year: 'numeric' }).format(now));
  const start = Number(objective.validityStartYear ?? objective.validity_start_year) || Number(String(objective.createdDate || objective.created_date || objective.created_at || '').slice(0, 4)) || year;
  const end = Number(objective.validityEndYear ?? objective.validity_end_year) || Number(String(objective.targetDate || objective.target_date || '').slice(0, 4)) || year;
  return start <= year && end >= year ? 'Activo' : 'No activo';
}

export function activeObjectives(objectives, now = new Date()) {
  return objectives.filter(objective => objectiveActivityStatus(objective, now) === 'Activo');
}


// Objective progress is the mean advancement of its latest indicator measurements.
export function withIndicatorMeasurementProgress(objectives = [], indicators = [], reports = []) {
  return objectives.map(objective => {
    const indicatorIds = new Set(indicators.filter(indicator => String(indicator.objectiveId ?? indicator.objective_id) === String(objective.id)).map(indicator => String(indicator.id)));
    const values = [...indicatorIds].map(id => {
      const history = reports.filter(report => String(report.indicatorId ?? report.indicator_id) === id && report.result != null && report.status !== 'Sin datos')
        .sort((a, b) => String(a.period || '').localeCompare(String(b.period || '')) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
      const latest = history.at(-1);
      if (!latest) return null;
      const result = Number(latest.result), target = Number(latest.measurement_target ?? latest.target);
      if (!Number.isFinite(result) || !Number.isFinite(target) || target === 0) return null;
      const comparator = latest.measurement_comparator || latest.comparator || '>=';
      const raw = comparator === '<=' || comparator === '<' ? target / result * 100 : result / target * 100;
      return Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : null;
    }).filter(value => value != null);
    return { ...objective, progress: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0 };
  });
}
