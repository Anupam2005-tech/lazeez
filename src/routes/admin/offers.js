const express = require('express');
const router = express.Router();
const offerController = require('../../controllers/admin/offerController');

router.get('/', offerController.listOffers);
router.get('/add', offerController.showAddForm);
router.post('/add', ...offerController.upload, offerController.addOffer);
router.get('/edit/:id', offerController.showEditForm);
router.post('/edit/:id', ...offerController.upload, offerController.editOffer);
router.post('/delete/:id', offerController.deleteOffer);

module.exports = router;
