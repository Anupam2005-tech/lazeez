const express = require('express');
const router = express.Router();
const categoryController = require('../../controllers/admin/categoryController');

const validate = require('../../middleware/validate');
const { categorySchema } = require('../../schemas/adminSchema');

router.get('/', categoryController.listCategories);
router.get('/add', categoryController.showAddForm);
router.post('/add', ...categoryController.upload, validate(categorySchema), categoryController.addCategory);
router.get('/edit/:id', categoryController.showEditForm);
router.post('/edit/:id', ...categoryController.upload, validate(categorySchema), categoryController.editCategory);
router.post('/delete/:id', categoryController.deleteCategory);

module.exports = router;
