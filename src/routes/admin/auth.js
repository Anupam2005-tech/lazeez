const express = require('express');
const router = express.Router();
const adminAuthController = require('../../controllers/admin/authController');

router.get('/login', adminAuthController.showLogin);
router.post('/verify-token', adminAuthController.verifyToken);
router.post('/local-login', adminAuthController.localLogin);
router.post('/logout', adminAuthController.logout);

module.exports = router;
