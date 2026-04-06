const express = require('express');
const router = express.Router();
const menuController = require('../../controllers/admin/menuController');

const validate = require('../../middleware/validate');
const { menuItemSchema } = require('../../schemas/adminSchema');

router.get('/', menuController.listItems);
router.get('/add', menuController.showAddForm);
router.post('/add', ...menuController.upload, validate(menuItemSchema), menuController.addItem);
router.get('/edit/:uid', menuController.showEditForm);
router.post('/edit/:uid', ...menuController.upload, validate(menuItemSchema), menuController.editItem);
router.post('/delete/:uid', menuController.deleteItem);

module.exports = router;
