function normalizeReporterName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function displayReporterName(name) {
  return normalizeReporterName(name)
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Filtro Mongo case-insensitive para reporterName */
function reporterNameFilter(name) {
  const key = normalizeReporterName(name);
  return {
    reporterName: {
      $regex: `^${escapeRegex(key)}$`,
      $options: 'i',
    },
  };
}

module.exports = {
  normalizeReporterName,
  displayReporterName,
  reporterNameFilter,
};
