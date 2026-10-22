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


export function withIndicatorSiteProgress(objectives = [], indicators = [], reports = []) {
  const id = value => String(value ?? '');
  const reportTime = report => new Date(report.date || report.registered_date || report.created_at || 0).getTime();
  const valueFor = (indicator, report) => {
    const result = Number(report?.result), target = Number(indicator.target);
    if (!Number.isFinite(result) || !Number.isFinite(target) || !target || (result === 0 && ['<=', '<'].includes(indicator.comparator))) return null;
    const raw = ['<=', '<'].includes(indicator.comparator || '>=') ? (target / result) * 100 : (result / target) * 100;
    return Math.max(0, Math.min(100, raw));
  };
  return objectives.map(objective => {
    const values = indicators.filter(indicator => id(indicator.objectiveId ?? indicator.objective_id) === id(objective.id)).flatMap(indicator => {
      const latest = new Map();
      reports.filter(report => id(report.indicatorId ?? report.indicator_id) === id(indicator.id)).forEach(report => {
        const key = id(report.assignmentId ?? report.site_assignment_id) || 'general';
        if (!latest.has(key) || reportTime(report) >= reportTime(latest.get(key))) latest.set(key, report);
      });
      return [...latest.values()].map(report => valueFor(indicator, report)).filter(value => value !== null);
    });
    return { ...objective, progress: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0 };
  });
};