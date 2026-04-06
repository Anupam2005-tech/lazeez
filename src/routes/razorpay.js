const express = require('express');
const router = express.Router();
const razorpayController = require('../controllers/razorpayController');
const { requireAuth } = require('../middleware/auth');

router.post('/webhook', express.raw({ type: 'application/json' }), razorpayController.handleWebhook);
router.get('/success/:orderId', requireAuth, razorpayController.handleSuccess);
router.get('/cancel', requireAuth, razorpayController.handleCancel);

module.exports = router;
