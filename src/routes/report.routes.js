const express = require('express');
const reportController = require('../controllers/reportController');
const { requireLogin, requireApiLogin } = require('../middlewares/auth');

const router = express.Router();

router.get('/report/realtime', requireLogin, reportController.showRealtime);
router.get('/report/total', requireLogin, reportController.showTotal);

router.post('/api/votes/realtime', requireApiLogin, reportController.createRealtime);
router.post('/api/votes/total', requireApiLogin, reportController.createTotal);
router.post('/api/votes/sync', requireApiLogin, reportController.syncVotes);
router.get('/api/votes/counts', requireApiLogin, reportController.getMyCounts);

// Formulario clásico de total (fallback sin JS)
router.post('/report/total', requireLogin, reportController.createTotal);

module.exports = router;
