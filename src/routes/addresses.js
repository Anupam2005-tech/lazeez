const express = require('express');
const router = express.Router();

router.get('/', (req, res, next) => require('../controllers/addressController').list(req, res, next));
router.post('/', (req, res, next) => require('../controllers/addressController').create(req, res, next));
router.put('/:id', (req, res, next) => require('../controllers/addressController').update(req, res, next));
router.delete('/:id', (req, res, next) => require('../controllers/addressController').remove(req, res, next));
router.put('/:id/set-default', (req, res, next) => require('../controllers/addressController').setDefault(req, res, next));

module.exports = router;
