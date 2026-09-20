const { v4: uuidv4 } = require('uuid');
const voteService = require('../services/voteService');
const { normalizeReporterName } = require('../utils/names');

function reporterKey(req) {
  return req.session.user.reporterKey || normalizeReporterName(req.session.user.name);
}

async function showRealtime(req, res) {
  const counts = await voteService.getRealtimeCounts(reporterKey(req));
  res.render('reports/realtime', {
    title: 'Reporte en tiempo real',
    counts,
  });
}

async function showTotal(req, res) {
  res.render('reports/total', {
    title: 'Reporte total final',
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
    if (items.length === 0) {
      return res.json({ ok: true, results: [] });
    }

    const results = await voteService.syncBatch({
      reporterName: reporterKey(req),
      items,
    });

    const counts = await voteService.getRealtimeCounts(reporterKey(req));
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

module.exports = {
  showRealtime,
  showTotal,
  createRealtime,
  createTotal,
  syncVotes,
  getMyCounts,
};
