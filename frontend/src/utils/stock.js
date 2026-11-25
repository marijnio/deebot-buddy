const SINGULAR_UNITS = {
  bags: 'bag',
  filters: 'filter',
  rollers: 'roller',
  brushes: 'brush',
  bottles: 'bottle',
  units: 'unit',
};

export function formatUnitLabel(count, unitLabel = 'units') {
  if (count !== 1) return unitLabel;
  if (SINGULAR_UNITS[unitLabel]) return SINGULAR_UNITS[unitLabel];
  if (unitLabel.endsWith('shes') || unitLabel.endsWith('ches') || unitLabel.endsWith('xes')) {
    return unitLabel.slice(0, -2);
  }
  if (unitLabel.endsWith('s') && unitLabel.length > 1) {
    return unitLabel.slice(0, -1);
  }
  return unitLabel;
}

export function formatInStock(count, unitLabel = 'units') {
  return `${count} ${formatUnitLabel(count, unitLabel)} in stock`;
}
