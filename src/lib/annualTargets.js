import { parseReportPeriod } from './reporting';

const sameId = (left, right) => String(left) === String(right);

export function targetForYear(indicator, annualTargets = [], year = '', siteId = '') {
  const matchesIndicatorAndYear = item => sameId(item.indicator_id, indicator?.id) && String(item.target_year) === String(year);
  const annual = (siteId && siteId !== 'weighted'
    ? annualTargets.find(item => matchesIndicatorAndYear(item) && sameId(item.site_id, siteId))
    : null) || annualTargets.find(item => matchesIndicatorAndYear(item) && item.site_id == null);
  return {
    target: annual ? Number(annual.target) : indicator?.target,
    comparator: annual?.comparator || indicator?.comparator,
  };
}

export function targetForReport(indicator, annualTargets = [], report) {
  if (report?.measurementTarget != null) {
    return { target: Number(report.measurementTarget), comparator: report.measurementComparator || indicator?.comparator };
  }
  return targetForYear(indicator, annualTargets, parseReportPeriod(report?.period)?.year || '');
}
