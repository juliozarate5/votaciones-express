function formatDateTime(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}

module.exports = { formatDateTime };
