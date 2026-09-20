const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { requireLogin, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

router.get('/dashboard/mine', requireLogin, dashboardController.showMine);
router.get('/dashboard/admin', requireAdmin, dashboardController.showAdmin);
router.get('/dashboard/stats', requireAdmin, dashboardController.showStats);
router.get('/dashboard/admin/export/excel', requireAdmin, dashboardController.exportExcel);
router.get('/dashboard/admin/export/pdf', requireAdmin, dashboardController.exportPdf);
router.get('/dashboard/admin/reset', requireAdmin, dashboardController.showReset);
router.post('/dashboard/admin/reset', requireAdmin, dashboardController.resetDatabase);

module.exports = router;
