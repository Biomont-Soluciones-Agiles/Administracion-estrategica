import { parseReportPeriod } from './reporting.js';

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


// Objective progress is the consolidated measurement of its indicator for the current year.
export function withIndicatorMeasurementProgress(objectives = [], indicators = [], reports = [], now = new Date()) {
  const currentYear = String(new Intl.DateTimeFormat('en', { timeZone: 'America/Lima', year: 'numeric' }).format(now));
  return objectives.map(objective => {
    const indicator = indicators.find(item => String(item.objectiveId ?? item.objective_id) === String(objective.id));
    if (!indicator) return { ...objective, progress: 0 };

    const currentYearReports = reports
      .filter(report => String(report.indicatorId ?? report.indicator_id) === String(indicator.id) && report.result != null && report.status !== 'Sin datos')
      .map(report => ({ report, period: parseReportPeriod(report.period) }))
      .filter(item => item.period?.year === currentYear && Number.isFinite(Number(item.report.result)));

    if (!currentYearReports.length) return { ...objective, progress: 0 };

    const consolidated = currentYearReports.reduce((sum, item) => sum + Number(item.report.result), 0) / currentYearReports.length;
    return { ...objective, progress: Number(consolidated.toFixed(2)) };
  });
}
