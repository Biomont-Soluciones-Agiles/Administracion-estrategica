-- Las cargas masivas de este formato usan porcentaje como unidad.
-- Se corrigen los dos registros afectados por la regla histórica de detección de ratios.
update public.indicators
set
  unit = '%',
  target = case
    when code = 'IND-26002' then 25
    else target
  end,
  updated_at = now()
where code in ('IND-26002', 'IND-26007')
  and unit = 'Ratio';
