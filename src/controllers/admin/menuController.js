const db = require('../../config/db');
const { imageUpload, deleteImage } = require('../../middleware/imageUpload');
const appCache = require('../../services/cache');

function generateUid() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function generateUniqueUid() {
  let uid;
  let exists = true;
  while (exists) {
    uid = generateUid();
    const existing = await db.menuItem.findUnique({ where: { uid } });
    exists = !!existing;
  }
  return uid;
}

async function listItems(req, res) {
  const items = await db.menuItem.findMany({
    include: { category: true },
    orderBy: { createdAt: 'desc' }
  });
  const categories = await db.category.findMany();
  res.render('admin/menu/index', { title: 'Menu Management', layout: 'layouts/admin', items, categories });
}

async function showAddForm(req, res) {
  const categories = await db.category.findMany();
  res.render('admin/menu/add', { title: 'Add Menu Item', layout: 'layouts/admin', categories });
}

async function addItem(req, res) {
  try {
    const { name, description, price, categoryId, available, isVeg, isBestSeller } = req.body;
    const imagePath = req.file ? req.file.filename : null;
    const uid = await generateUniqueUid();

    await db.menuItem.create({
      data: {
        uid,
        name,
        description,
        price: parseFloat(price),
        categoryId: categoryId,
        available: available === 'on',
        isVeg: isVeg === 'on',
        isBestSeller: isBestSeller === 'on',
        image: imagePath
      }
    });
    await appCache.refresh();
    res.redirect('/admin/menu');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating menu item');
  }
}

async function showEditForm(req, res) {
  const item = await db.menuItem.findUnique({ where: { uid: req.params.uid } });
  if (!item) return res.redirect('/admin/menu');
  const categories = await db.category.findMany();
  res.render('admin/menu/edit', { title: 'Edit Menu Item', layout: 'layouts/admin', item, categories });
}

async function editItem(req, res) {
  try {
    const { name, description, price, categoryId, available, isVeg, isBestSeller } = req.body;
    const uid = req.params.uid;

    const updateData = {
      name,
      description,
      price: parseFloat(price),
      categoryId: categoryId,
      available: available === 'on',
      isVeg: isVeg === 'on',
      isBestSeller: isBestSeller === 'on'
    };

    if (req.file) {
      const item = await db.menuItem.findUnique({ where: { uid } });
      if (item && item.image) {
        await deleteImage(item.image);
      }
      updateData.image = req.file.filename;
    }

    await db.menuItem.update({ where: { uid }, data: updateData });
    await appCache.refresh();
    res.redirect('/admin/menu');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating menu item');
  }
}

async function deleteItem(req, res) {
  try {
    const item = await db.menuItem.findUnique({ where: { uid: req.params.uid } });
    if (item && item.image) {
      await deleteImage(item.image);
    }
    await db.menuItem.delete({ where: { uid: req.params.uid } });
    await appCache.refresh();
  } catch (e) {
    console.error(e);
  }
  res.redirect('/admin/menu');
}

module.exports = { upload: imageUpload({ prefix: 'dish' }), listItems, showAddForm, addItem, showEditForm, editItem, deleteItem };
