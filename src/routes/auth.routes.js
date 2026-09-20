const express = require('express');
const authController = require('../controllers/authController');
const { requireLogin } = require('../middlewares/auth');

const router = express.Router();

router.get('/login', authController.showLogin);
router.post('/login', authController.login);
router.post('/logout', requireLogin, authController.logout);

module.exports = router;
