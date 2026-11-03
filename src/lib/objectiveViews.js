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


const indicatorAchievement = (result, target, comparator) => {
  const value = Number(result);
  const goal = Number(target);
  if (!Number.isFinite(value) || !Number.isFinite(goal)) return 0;
  if (comparator === '=') return value === goal ? 100 : 0;
  if (comparator === '<=' || comparator === '<') {
    if (value <= goal) return 100;
    return goal > 0 && value > 0 ? Math.max(0, Math.min(100, goal / value * 100)) : 0;
  }
  if (goal <= 0) return value >= goal ? 100 : 0;
  return Math.max(0, Math.min(100, value / goal * 100));
};

// Objective progress is the equal-weighted compliance of every linked indicator.
// Missing current-year measurements intentionally contribute 0%.
export function withIndicatorMeasurementProgress(objectives = [], indicators = [], reports = [], now = new Date()) {
  const currentYear = String(new Intl.DateTimeFormat('en', { timeZone: 'America/Lima', year: 'numeric' }).format(now));
  return objectives.map(objective => {
    const objectiveIndicators = indicators.filter(item => String(item.objectiveId ?? item.objective_id) === String(objective.id));
    if (!objectiveIndicators.length) return { ...objective, progress: 0, indicatorCount: 0, measuredIndicatorCount: 0 };

    const equalWeight = 100 / objectiveIndicators.length;
    const summaries = objectiveIndicators.map(indicator => {
      const latest = reports
        .filter(report => String(report.indicatorId ?? report.indicator_id) === String(indicator.id) && report.result != null && report.status !== 'Sin datos')
        .map(report => ({ report, period: parseReportPeriod(report.period) }))
        .filter(item => item.period?.year === currentYear && Number.isFinite(Number(item.report.result)))
        .sort((left, right) => right.period.order - left.period.order || Number(right.report.id || 0) - Number(left.report.id || 0))[0];
      const weight = Number(indicator.objectiveWeight ?? indicator.objective_weight);
      const normalizedWeight = Number.isFinite(weight) && weight > 0 ? weight : equalWeight;
      return {
        indicator,
        measured: Boolean(latest),
        weight: normalizedWeight,
        compliance: latest ? indicatorAchievement(latest.report.result, indicator.target, indicator.comparator) : 0,
      };
    });
    const totalWeight = summaries.reduce((sum, item) => sum + item.weight, 0) || 100;
    const progress = summaries.reduce((sum, item) => sum + item.compliance * item.weight / totalWeight, 0);
    return {
      ...objective,
      progress: Number(progress.toFixed(2)),
      indicatorCount: summaries.length,
      measuredIndicatorCount: summaries.filter(item => item.measured).length,
    };
  });
}
