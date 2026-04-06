const express = require('express');
const router = express.Router();
const reportsController = require('../../controllers/admin/reportsController');

router.get('/', reportsController.showReports);

module.exports = router;
