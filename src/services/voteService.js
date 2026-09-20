const VoteReport = require('../models/VoteReport');
const {
  normalizeReporterName,
  displayReporterName,
  reporterNameFilter,
} = require('../utils/names');

async function getLatestTotal(reporterName) {
  const filter = reporterNameFilter(reporterName);
  return VoteReport.findOne({ ...filter, type: 'total' }).sort({ createdAt: -1 }).lean();
}

async function getLatestTotalDoc(reporterName) {
  const filter = reporterNameFilter(reporterName);
  return VoteReport.findOne({ ...filter, type: 'total' }).sort({ createdAt: -1 });
}

async function applyGenderDeltaToLatestFinal(reporterName, gender, delta) {
  if (!['female', 'male'].includes(gender) || !delta) return null;
  const doc = await getLatestTotalDoc(reporterName);
  if (!doc) return null;

  if (gender === 'female') {
    doc.women = Math.max(0, Number(doc.women || 0) + delta);
  } else {
    doc.men = Math.max(0, Number(doc.men || 0) + delta);
  }
  doc.total = Number(doc.women || 0) + Number(doc.men || 0);
  doc.syncedAt = new Date();
  await doc.save();
  return doc.toObject();
}

async function saveRealtimeVote({ reporterName, gender, clientId, createdAt }) {
  const key = normalizeReporterName(reporterName);

  try {
    const existing = await VoteReport.findOne({ clientId }).lean();
    if (existing) {
      // Idempotencia: no crear ni sumar otra vez al final
      return { created: false, report: existing, latestFinal: await getLatestTotal(key) };
    }

    const report = await VoteReport.create({
      reporterName: key,
      type: 'realtime',
      gender,
      clientId,
      syncedAt: new Date(),
      createdAt: createdAt ? new Date(createdAt) : undefined,
    });

    // Si ya hay un total final, estos votos se suman al último final
    const latestFinal = await applyGenderDeltaToLatestFinal(key, gender, 1);

    return { created: true, report, latestFinal };
  } catch (err) {
    // Carrera: otro request creó el mismo clientId
    if (err && (err.code === 11000 || String(err.message || '').includes('E11000'))) {
      const existing = await VoteReport.findOne({ clientId }).lean();
      if (existing) {
        return { created: false, report: existing, latestFinal: await getLatestTotal(key) };
      }
    }
    throw err;
  }
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
    return { created: false, report: existing, deletedRealtime: 0 };
  }

  const filter = reporterNameFilter(key);
  // El total final pasa a ser lo válido: se resetea el conteo voto a voto
  const deleted = await VoteReport.deleteMany({ ...filter, type: 'realtime' });

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

  return {
    created: true,
    report,
    deletedRealtime: deleted.deletedCount || 0,
  };
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
        results.push({
          clientId: item.clientId,
          ok: true,
          created: result.created,
          deletedRealtime: result.deletedRealtime,
        });
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

  const latestFinal = totals.length ? totals[totals.length - 1] : null;
  const totalsAgg = latestFinal
    ? {
        women: latestFinal.women || 0,
        men: latestFinal.men || 0,
        total: latestFinal.total || 0,
      }
    : { women: 0, men: 0, total: 0 };

  return {
    reporterName: displayReporterName(key),
    realtime,
    totals,
    totalsAgg,
    latestFinal,
  };
}

async function getAdminSummary() {
  const reports = await VoteReport.find({}).sort({ reporterName: 1, createdAt: 1 }).lean();
  const byReporter = new Map();

  for (const report of reports) {
    const key = normalizeReporterName(report.reporterName);
    const at = report.createdAt || report.syncedAt;
    if (!byReporter.has(key)) {
      byReporter.set(key, {
        reporterKey: key,
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
      // Solo el último final cuenta como válido (ya incluye votos a voto posteriores)
      row.totalReports += 1;
      if (!row.lastTotalAt || at >= row.lastTotalAt) {
        row.lastTotalAt = at;
        row.totalWomen = report.women || 0;
        row.totalMen = report.men || 0;
        row.totalVotes = report.total || 0;
      }
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
  const latestFinal = await getLatestTotal(reporterName);

  // Si hay total final válido, el conteo voto a voto continúa desde ese total
  if (latestFinal) {
    const women = Number(latestFinal.women || 0);
    const men = Number(latestFinal.men || 0);
    return {
      female: women,
      male: men,
      total: women + men,
      source: 'final',
      latestFinal: {
        women,
        men,
        total: women + men,
        createdAt: latestFinal.createdAt,
      },
    };
  }

  const [female, male] = await Promise.all([
    VoteReport.countDocuments({ ...filter, type: 'realtime', gender: 'female' }),
    VoteReport.countDocuments({ ...filter, type: 'realtime', gender: 'male' }),
  ]);
  return {
    female,
    male,
    total: female + male,
    source: 'realtime',
    latestFinal: null,
  };
}

async function getLastRealtimeVote(reporterName) {
  const filter = reporterNameFilter(reporterName);
  return VoteReport.findOne({ ...filter, type: 'realtime' }).sort({ createdAt: -1 }).lean();
}

async function annulRealtimeVote({ reporterName, clientId }) {
  const key = normalizeReporterName(reporterName);
  const filter = reporterNameFilter(key);
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

  const gender = vote.gender;
  await VoteReport.deleteOne({ _id: vote._id });
  await applyGenderDeltaToLatestFinal(key, gender, -1);

  return { deleted: true, vote: vote.toObject ? vote.toObject() : vote };
}

async function switchRealtimeGender({ reporterName, clientId, gender }) {
  const key = normalizeReporterName(reporterName);
  const filter = reporterNameFilter(key);
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

  const prevGender = vote.gender;
  vote.gender = nextGender;
  vote.syncedAt = new Date();
  await vote.save();

  await applyGenderDeltaToLatestFinal(key, prevGender, -1);
  await applyGenderDeltaToLatestFinal(key, nextGender, 1);

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
  getLatestTotal,
  getLastRealtimeVote,
  annulRealtimeVote,
  switchRealtimeGender,
  resetAllVotes,
};
