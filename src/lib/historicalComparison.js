import { MONTHS, parseReportPeriod } from './reporting.js';

export const comparisonKey = year => `year_${year}`;

export function historicalComparisonSeries(reports, selectedYears = []) {
  const years = [...new Set(selectedYears.map(String))];
  const values = new Map();
  const sorted = [...reports].sort((a, b) =>
    String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
    Number(a.id || 0) - Number(b.id || 0)
  );

  for (const report of sorted) {
    const period = parseReportPeriod(report.period);
    if (!period || !years.includes(period.year)) continue;
    values.set(`${period.year}-${period.month}`,
      report.result == null || report.status === 'Sin datos' || !Number.isFinite(Number(report.result))
        ? null
        : Number(report.result)
    );
  }

  return MONTHS.map(month => {
    const row = { period: month.slice(0, 3), monthName: month };
    years.forEach(year => { row[comparisonKey(year)] = values.get(`${year}-${month.toLowerCase()}`) ?? null; });
    return row;
  });
}
