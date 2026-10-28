import { parseReportPeriod } from './reporting.js';

const REPORTING_INTERVALS = {
  Mensual: 1,
  Bimestral: 2,
  Trimestral: 3,
  Semestral: 6,
  Anual: 12,
};

export function reportingIntervalMonths(frequency) {
  return REPORTING_INTERVALS[frequency] || REPORTING_INTERVALS.Mensual;
}

export function isReportDue(indicator, history, now = new Date()) {
  const latest = history.at(-1);
  const lastPeriod = parseReportPeriod(latest?.period);
  if (!lastPeriod) return false;

  const currentPeriodOrder = now.getFullYear() * 12 + now.getMonth();
  const frequency = indicator.reviewFrequency || indicator.review_frequency || indicator.frequency;
  return currentPeriodOrder >= lastPeriod.order + reportingIntervalMonths(frequency);
}

export function portfolioRows(indicators, reports, period = '') {
  return indicators.map(indicator => {
    const history = reports.filter(report => String(report.indicatorId) === String(indicator.id))
      .sort((a, b) => (parseReportPeriod(a.period)?.order || 0) - (parseReportPeriod(b.period)?.order || 0) || Number(a.id) - Number(b.id));
    const selected = period ? history.filter(report => parseReportPeriod(report.period)?.order === Number(period)) : history;
    const latest = selected.at(-1);
    return {
      indicator,
      history: period ? history.filter(report => (parseReportPeriod(report.period)?.order || 0) <= Number(period)) : history,
      latest,
      status: latest?.status || 'Sin reporte',
      reportDue: !period && isReportDue(indicator, history),
    };
  });
}

export function portfolioCounts(rows) {
  return {
    total: rows.length,
    inTarget: rows.filter(row => row.status === 'En meta').length,
    outOfTarget: rows.filter(row => row.status === 'Fuera de meta').length,
    noData: rows.filter(row => row.status === 'Sin datos').length,
    unreported: rows.filter(row => row.status === 'Sin reporte').length,
    due: rows.filter(row => row.reportDue).length,
  };
}
