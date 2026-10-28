export function displayUnit(unit) {
  const normalized = String(unit || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const units = {
    numero: '',
    soles: 'S/.',
    dolares: 'USD$',
    horas: 'h',
    dias: 'd',
  };
  return Object.prototype.hasOwnProperty.call(units, normalized) ? units[normalized] : String(unit || '').trim();
}
