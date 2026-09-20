const VoteReport = require('../models/VoteReport');
const {
  normalizeReporterName,
  displayReporterName,
  reporterNameFilter,
} = require('../utils/names');

async function saveRealtimeVote({ reporterName, gender, clientId, createdAt }) {
  const key = normalizeReporterName(reporterName);
  const existing = await VoteReport.findOne({ clientId }).lean();
  if (existing) {
    return { created: false, report: existing };
  }

  const report = await VoteReport.create({
    reporterName: key,
    type: 'realtime',
    gender,
    clientId,
    syncedAt: new Date(),
    createdAt: createdAt ? new Date(createdAt) : undefined,
  });

  return { created: true, report };
}

async function saveTotalReport({ reporterName, women, men, total, clientId, createdAt }) {
  const key = normalizeReporterName(reporterName);
  const w = Number(women);
  const m = Number(men);
  const t = Number(total);

  if (![w, m, t].every((n) => Number.isInteger(n) && n >= 0)) {
    const err = new Error('Los valores deben ser enteros mayores o iguales a 0');
    err.status = 400;
    throw err;
  }

  if (w + m !== t) {
    const err = new Error('La suma de mujeres y hombres debe ser igual al total');
    err.status = 400;
    throw err;
  }

  const existing = await VoteReport.findOne({ clientId }).lean();
  if (existing) {
    return { created: false, report: existing };
  }

  const report = await VoteReport.create({
    reporterName: key,
    type: 'total',
    women: w,
    men: m,
    total: t,
    clientId,
    syncedAt: new Date(),
    createdAt: createdAt ? new Date(createdAt) : undefined,
  });

  return { created: true, report };
}

async function syncBatch({ reporterName, items }) {
  const results = [];
  const key = normalizeReporterName(reporterName);

  for (const item of items || []) {
    try {
      if (item.type === 'realtime') {
        const result = await saveRealtimeVote({
          reporterName: key,
          gender: item.payload?.gender || item.gender,
          clientId: item.clientId,
          createdAt: item.createdAt,
        });
        results.push({ clientId: item.clientId, ok: true, created: result.created });
      } else if (item.type === 'total') {
        const payload = item.payload || item;
        const result = await saveTotalReport({
          reporterName: key,
          women: payload.women,
          men: payload.men,
          total: payload.total,
          clientId: item.clientId,
          createdAt: item.createdAt,
        });
        results.push({ clientId: item.clientId, ok: true, created: result.created });
      } else {
        results.push({ clientId: item.clientId, ok: false, error: 'Tipo inválido' });
      }
    } catch (err) {
      results.push({ clientId: item.clientId, ok: false, error: err.message });
    }
  }

  return results;
}

async function getReporterSummary(reporterName) {
  const key = normalizeReporterName(reporterName);
  const reports = await VoteReport.find(reporterNameFilter(key)).sort({ createdAt: 1 }).lean();

  const realtime = {
    female: 0,
    male: 0,
    total: 0,
    items: [],
    firstAt: null,
    lastAt: null,
  };
  const totals = [];

  for (const report of reports) {
    const at = report.createdAt || report.syncedAt;
    if (report.type === 'realtime') {
      if (report.gender === 'female') realtime.female += 1;
      if (report.gender === 'male') realtime.male += 1;
      realtime.total += 1;
      realtime.items.push(report);
      if (!realtime.firstAt || at < realtime.firstAt) realtime.firstAt = at;
      if (!realtime.lastAt || at > realtime.lastAt) realtime.lastAt = at;
    } else if (report.type === 'total') {
      totals.push(report);
    }
  }

  const totalsAgg = totals.reduce(
    (acc, row) => {
      acc.women += row.women || 0;
      acc.men += row.men || 0;
      acc.total += row.total || 0;
      return acc;
    },
    { women: 0, men: 0, total: 0 }
  );

  return { reporterName: displayReporterName(key), realtime, totals, totalsAgg };
}

async function getAdminSummary() {
  const reports = await VoteReport.find({}).sort({ reporterName: 1, createdAt: 1 }).lean();
  const byReporter = new Map();

  for (const report of reports) {
    const key = normalizeReporterName(report.reporterName);
    const at = report.createdAt || report.syncedAt;
    if (!byReporter.has(key)) {
      byReporter.set(key, {
        reporterName: displayReporterName(key),
        realtimeFemale: 0,
        realtimeMale: 0,
        realtimeTotal: 0,
        totalWomen: 0,
        totalMen: 0,
        totalVotes: 0,
        totalReports: 0,
        firstRealtimeAt: null,
        lastRealtimeAt: null,
        lastTotalAt: null,
      });
    }

    const row = byReporter.get(key);
    if (report.type === 'realtime') {
      if (report.gender === 'female') row.realtimeFemale += 1;
      if (report.gender === 'male') row.realtimeMale += 1;
      row.realtimeTotal += 1;
      if (!row.firstRealtimeAt || at < row.firstRealtimeAt) row.firstRealtimeAt = at;
      if (!row.lastRealtimeAt || at > row.lastRealtimeAt) row.lastRealtimeAt = at;
    } else if (report.type === 'total') {
      row.totalWomen += report.women || 0;
      row.totalMen += report.men || 0;
      row.totalVotes += report.total || 0;
      row.totalReports += 1;
      if (!row.lastTotalAt || at > row.lastTotalAt) row.lastTotalAt = at;
    }
  }

  const rows = Array.from(byReporter.values()).sort((a, b) =>
    a.reporterName.localeCompare(b.reporterName, 'es')
  );

  const grand = rows.reduce(
    (acc, row) => {
      acc.realtimeFemale += row.realtimeFemale;
      acc.realtimeMale += row.realtimeMale;
      acc.realtimeTotal += row.realtimeTotal;
      acc.totalWomen += row.totalWomen;
      acc.totalMen += row.totalMen;
      acc.totalVotes += row.totalVotes;
      return acc;
    },
    {
      realtimeFemale: 0,
      realtimeMale: 0,
      realtimeTotal: 0,
      totalWomen: 0,
      totalMen: 0,
      totalVotes: 0,
    }
  );

  return { rows, grand };
}

async function getRealtimeCounts(reporterName) {
  const filter = reporterNameFilter(reporterName);
  const [female, male] = await Promise.all([
    VoteReport.countDocuments({ ...filter, type: 'realtime', gender: 'female' }),
    VoteReport.countDocuments({ ...filter, type: 'realtime', gender: 'male' }),
  ]);
  return { female, male, total: female + male };
}

async function getLastRealtimeVote(reporterName) {
  const filter = reporterNameFilter(reporterName);
  return VoteReport.findOne({ ...filter, type: 'realtime' }).sort({ createdAt: -1 }).lean();
}

async function annulRealtimeVote({ reporterName, clientId }) {
  const filter = reporterNameFilter(reporterName);
  const query = { ...filter, type: 'realtime' };
  if (clientId) query.clientId = clientId;

  const vote = clientId
    ? await VoteReport.findOne(query)
    : await VoteReport.findOne(query).sort({ createdAt: -1 });

  if (!vote) {
    const err = new Error('No hay voto para anular');
    err.status = 404;
    throw err;
  }

  await VoteReport.deleteOne({ _id: vote._id });
  return { deleted: true, vote: vote.toObject ? vote.toObject() : vote };
}

async function switchRealtimeGender({ reporterName, clientId, gender }) {
  const filter = reporterNameFilter(reporterName);
  const query = { ...filter, type: 'realtime' };
  if (clientId) query.clientId = clientId;

  const vote = clientId
    ? await VoteReport.findOne(query)
    : await VoteReport.findOne(query).sort({ createdAt: -1 });

  if (!vote) {
    const err = new Error('No hay voto para corregir');
    err.status = 404;
    throw err;
  }

  let nextGender = gender;
  if (!['female', 'male'].includes(nextGender)) {
    nextGender = vote.gender === 'female' ? 'male' : 'female';
  }

  if (vote.gender === nextGender) {
    return { changed: false, vote: vote.toObject ? vote.toObject() : vote };
  }

  vote.gender = nextGender;
  vote.syncedAt = new Date();
  await vote.save();
  return { changed: true, vote: vote.toObject ? vote.toObject() : vote };
}

async function resetAllVotes() {
  const before = await VoteReport.countDocuments();
  const result = await VoteReport.deleteMany({});
  return { before, deleted: result.deletedCount || 0 };
}

module.exports = {
  saveRealtimeVote,
  saveTotalReport,
  syncBatch,
  getReporterSummary,
  getAdminSummary,
  getRealtimeCounts,
  getLastRealtimeVote,
  annulRealtimeVote,
  switchRealtimeGender,
  resetAllVotes,
};
