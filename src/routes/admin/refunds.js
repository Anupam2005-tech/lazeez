const express = require('express');
const router = express.Router();
const refundController = require('../../controllers/admin/refundController');

router.get('/', refundController.listRefunds);
router.post('/:id/complete', refundController.markCompleted);

module.exports = router;
