const { v4: uuidv4 } = require('uuid');
const voteService = require('../services/voteService');
const { normalizeReporterName } = require('../utils/names');

function reporterKey(req) {
  return req.session.user.reporterKey || normalizeReporterName(req.session.user.name);
}

async function showRealtime(req, res) {
  const key = reporterKey(req);
  const [counts, lastVote] = await Promise.all([
    voteService.getRealtimeCounts(key),
    voteService.getLastRealtimeVote(key),
  ]);
  res.render('reports/realtime', {
    title: 'Contar voto a voto',
    counts,
    lastVote: lastVote
      ? {
          clientId: lastVote.clientId,
          gender: lastVote.gender,
          createdAt: lastVote.createdAt,
        }
      : null,
  });
}

async function showTotal(req, res) {
  res.render('reports/total', {
    title: 'Reportar solo totales',
  });
}

async function createRealtime(req, res) {
  try {
    const gender = req.body.gender;
    if (!['female', 'male'].includes(gender)) {
      return res.status(400).json({ ok: false, error: 'Género inválido' });
    }

    const clientId = req.body.clientId || uuidv4();
    const result = await voteService.saveRealtimeVote({
      reporterName: reporterKey(req),
      gender,
      clientId,
      createdAt: req.body.createdAt,
    });

    const counts = await voteService.getRealtimeCounts(reporterKey(req));
    return res.json({
      ok: true,
      created: result.created,
      clientId,
      counts,
      reportedAt: result.report?.createdAt || result.report?.syncedAt || new Date(),
    });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || 'No se pudo guardar el voto',
    });
  }
}

async function createTotal(req, res) {
  try {
    const clientId = req.body.clientId || uuidv4();
    const wantsJson =
      req.xhr ||
      (req.headers.accept || '').includes('application/json') ||
      req.path.startsWith('/api/');

    const result = await voteService.saveTotalReport({
      reporterName: reporterKey(req),
      women: req.body.women,
      men: req.body.men,
      total: req.body.total,
      clientId,
      createdAt: req.body.createdAt,
    });

    if (wantsJson) {
      return res.json({
        ok: true,
        created: result.created,
        clientId,
        reportedAt: result.report?.createdAt || result.report?.syncedAt || new Date(),
      });
    }

    req.flash('success', result.created ? 'Total final registrado' : 'Total ya estaba registrado');
    return res.redirect('/dashboard/mine');
  } catch (err) {
    console.error(err);
    const wantsJson =
      req.xhr ||
      (req.headers.accept || '').includes('application/json') ||
      req.path.startsWith('/api/');

    if (wantsJson) {
      return res.status(err.status || 500).json({
        ok: false,
        error: err.message || 'No se pudo guardar el total',
      });
    }

    req.flash('error', err.message || 'No se pudo guardar el total');
    return res.redirect('/report/total');
  }
}

async function syncVotes(req, res) {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const key = reporterKey(req);

    if (items.length === 0) {
      const counts = await voteService.getRealtimeCounts(key);
      return res.json({ ok: true, results: [], counts });
    }

    const results = await voteService.syncBatch({
      reporterName: key,
      items,
    });

    const counts = await voteService.getRealtimeCounts(key);
    return res.json({ ok: true, results, counts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Error al sincronizar' });
  }
}

async function getMyCounts(req, res) {
  try {
    const counts = await voteService.getRealtimeCounts(reporterKey(req));
    return res.json({ ok: true, counts });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'No se pudieron obtener conteos' });
  }
}

async function getLastRealtime(req, res) {
  try {
    const key = reporterKey(req);
    const [counts, lastVote] = await Promise.all([
      voteService.getRealtimeCounts(key),
      voteService.getLastRealtimeVote(key),
    ]);
    return res.json({
      ok: true,
      counts,
      lastVote: lastVote
        ? {
            clientId: lastVote.clientId,
            gender: lastVote.gender,
            createdAt: lastVote.createdAt,
          }
        : null,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'No se pudo obtener el último voto' });
  }
}

async function correctRealtime(req, res) {
  try {
    const action = String(req.body.action || '').trim();
    const clientId = req.body.clientId ? String(req.body.clientId).trim() : undefined;
    const key = reporterKey(req);

    if (!['annul', 'switch'].includes(action)) {
      return res.status(400).json({ ok: false, error: 'Acción inválida' });
    }

    let detail;
    if (action === 'annul') {
      detail = await voteService.annulRealtimeVote({ reporterName: key, clientId });
    } else {
      detail = await voteService.switchRealtimeGender({
        reporterName: key,
        clientId,
        gender: req.body.gender,
      });
    }

    const [counts, lastVote] = await Promise.all([
      voteService.getRealtimeCounts(key),
      voteService.getLastRealtimeVote(key),
    ]);

    return res.json({
      ok: true,
      action,
      detail,
      counts,
      lastVote: lastVote
        ? {
            clientId: lastVote.clientId,
            gender: lastVote.gender,
            createdAt: lastVote.createdAt,
          }
        : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || 'No se pudo corregir el voto',
    });
  }
}

module.exports = {
  showRealtime,
  showTotal,
  createRealtime,
  createTotal,
  syncVotes,
  getMyCounts,
  getLastRealtime,
  correctRealtime,
};
