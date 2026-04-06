const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');

router.get('/', addressController.list);
router.post('/', addressController.create);
router.put('/:id', addressController.update);
router.delete('/:id', addressController.remove);
router.put('/:id/set-default', addressController.setDefault);

module.exports = router;
