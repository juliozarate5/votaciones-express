const voteService = require('../services/voteService');
const exportService = require('../services/exportService');
const { normalizeReporterName } = require('../utils/names');

async function showMine(req, res) {
  const key = req.session.user.reporterKey || normalizeReporterName(req.session.user.name);
  const summary = await voteService.getReporterSummary(key);
  res.render('dashboard/mine', {
    title: 'Mi reporte',
    summary,
  });
}

async function showAdmin(req, res) {
  const summary = await voteService.getAdminSummary();
  const official = exportService.toOfficialReport(summary);
  res.render('dashboard/admin', {
    title: 'Reporte de todos',
    summary,
    official,
    wide: true,
  });
}

async function getReporterDetail(req, res) {
  try {
    const key = normalizeReporterName(req.params.key || '');
    if (!key) {
      return res.status(400).json({ ok: false, error: 'Persona inválida' });
    }
    const detail = await voteService.getReporterSummary(key);
    return res.json({
      ok: true,
      detail: {
        reporterName: detail.reporterName,
        current: detail.latestFinal
          ? {
              women: detail.latestFinal.women || 0,
              men: detail.latestFinal.men || 0,
              total: detail.latestFinal.total || 0,
              at: detail.latestFinal.createdAt || detail.latestFinal.syncedAt,
            }
          : {
              women: detail.realtime.female,
              men: detail.realtime.male,
              total: detail.realtime.total,
              at: detail.realtime.lastAt,
            },
        totalsHistory: (detail.totals || []).map((row) => ({
          women: row.women || 0,
          men: row.men || 0,
          total: row.total || 0,
          at: row.createdAt || row.syncedAt,
        })),
        realtimeSession: {
          female: detail.realtime.female,
          male: detail.realtime.male,
          total: detail.realtime.total,
          firstAt: detail.realtime.firstAt,
          lastAt: detail.realtime.lastAt,
        },
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'No se pudo cargar el detalle' });
  }
}

async function showStats(req, res) {
  const summary = await voteService.getAdminSummary();
  const charts = exportService.chartPayload(summary);
  res.render('dashboard/stats', {
    title: 'Dashboard estadístico',
    summary,
    charts,
    chartsJson: JSON.stringify(charts),
    wide: true,
  });
}

async function exportExcel(req, res) {
  try {
    const summary = await voteService.getAdminSummary();
    const buffer = await exportService.buildExcelBuffer(summary);
    const filename = `reporte-votaciones-${exportService.stamp()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    req.flash('error', 'No se pudo generar el Excel');
    return res.redirect('/dashboard/admin');
  }
}

async function exportPdf(req, res) {
  try {
    const summary = await voteService.getAdminSummary();
    const buffer = await exportService.buildPdfBuffer(summary);
    const filename = `reporte-votaciones-${exportService.stamp()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    console.error(err);
    req.flash('error', 'No se pudo generar el PDF');
    return res.redirect('/dashboard/admin');
  }
}

async function showReset(req, res) {
  const totalDocs = await require('../models/VoteReport').countDocuments();
  res.render('dashboard/reset', {
    title: 'Resetear base de datos',
    totalDocs,
    wide: true,
  });
}

async function resetDatabase(req, res) {
  try {
    const code = String(req.body.securityCode || '').trim();
    const confirmed = req.body.confirmDelete === 'yes';
    const expected = String(process.env.ADMIN_PASSWORD || '').trim();

    if (!confirmed) {
      req.flash('error', 'Debes marcar la casilla de confirmación');
      return res.redirect('/dashboard/admin/reset');
    }

    if (!/^\d+$/.test(code) || code !== expected) {
      req.flash('error', 'Código de seguridad incorrecto');
      return res.redirect('/dashboard/admin/reset');
    }

    const result = await voteService.resetAllVotes();
    req.flash(
      'success',
      `Base de reportes reiniciada. Se eliminaron ${result.deleted} registro(s).`
    );
    return res.redirect('/menu');
  } catch (err) {
    console.error(err);
    req.flash('error', 'No se pudo resetear la base de datos');
    return res.redirect('/dashboard/admin/reset');
  }
}

module.exports = {
  showMine,
  showAdmin,
  getReporterDetail,
  showStats,
  exportExcel,
  exportPdf,
  showReset,
  resetDatabase,
};
