const db = require('../../config/db');
const { imageUpload, deleteImage } = require('../../middleware/imageUpload');
const appCache = require('../../services/cache');

async function listCategories(req, res) {
  const categories = await db.category.findMany({
    include: { _count: { select: { menuItems: true } } },
    orderBy: { name: 'asc' }
  });
  res.render('admin/categories/index', {
    title: 'Category Management',
    layout: 'layouts/admin',
    categories
  });
}

function showAddForm(req, res) {
  res.render('admin/categories/add', {
    title: 'Add Category',
    layout: 'layouts/admin'
  });
}

async function addCategory(req, res) {
  try {
    const { name } = req.body;
    const data = { name: name.trim() };
    if (req.file) {
      data.image = req.file.filename;
    }
    await db.category.create({ data });
    appCache.refresh();
    res.redirect('/admin/categories');
  } catch (err) {
    console.error('Error creating category:', err);
    if (err.code === 'P2002') {
      res.status(400).send('A category with this name already exists.');
    } else {
      res.status(500).send('Error creating category');
    }
  }
}

async function showEditForm(req, res) {
  const id = req.params.id;
  const category = await db.category.findUnique({
    where: { id },
    include: { _count: { select: { menuItems: true } } }
  });
  if (!category) return res.redirect('/admin/categories');
  res.render('admin/categories/edit', {
    title: 'Edit Category',
    layout: 'layouts/admin',
    category
  });
}

async function editCategory(req, res) {
  try {
    const id = req.params.id;
    const { name } = req.body;
    const data = { name: name.trim() };

    if (req.file) {
      const category = await db.category.findUnique({ where: { id } });
      if (category && category.image) {
        await deleteImage(category.image);
      }
      data.image = req.file.filename;
    }

    await db.category.update({ where: { id }, data });
    appCache.refresh();
    res.redirect('/admin/categories');
  } catch (err) {
    console.error('Error updating category:', err);
    if (err.code === 'P2002') {
      res.status(400).send('A category with this name already exists.');
    } else {
      res.status(500).send('Error updating category');
    }
  }
}

async function deleteCategory(req, res) {
  try {
    const id = req.params.id;
    const category = await db.category.findUnique({
      where: { id },
      include: { _count: { select: { menuItems: true } } }
    });

    if (!category) return res.redirect('/admin/categories');

    if (category._count.menuItems > 0) {
      return res.status(400).send('Cannot delete category with existing menu items. Remove or reassign items first.');
    }

    if (category.image) {
      await deleteImage(category.image);
    }

    await db.category.delete({ where: { id } });
    appCache.refresh();
    res.redirect('/admin/categories');
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).send('Error deleting category');
  }
}

module.exports = { upload: imageUpload({ prefix: 'cat', uploadDir: 'categories' }), listCategories, showAddForm, addCategory, showEditForm, editCategory, deleteCategory };
