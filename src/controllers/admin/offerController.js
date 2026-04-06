const db = require('../../config/db');
const { imageUpload, deleteImage } = require('../../middleware/imageUpload');
const realtime = require('../../services/realtime');
const emailService = require('../../services/email');

async function listOffers(req, res) {
  const offers = await db.offer.findMany({ orderBy: { createdAt: 'desc' } });
  res.render('admin/offers/index', { title: 'Manage Offers', layout: 'layouts/admin', offers });
}

function showAddForm(req, res) {
  res.render('admin/offers/add', { title: 'Add Offer', layout: 'layouts/admin' });
}

async function addOffer(req, res) {
  try {
    const { name, description, active, dishName } = req.body;
    const data = {
      name: name.trim(),
      description: description ? description.trim() : null,
      dishName: dishName ? dishName.trim() : null,
      active: active === 'on' || active === 'true' || active === true,
      image: req.file ? req.file.filename : null
    };
    const offer = await db.offer.create({ data });
    realtime.broadcastToAll('offer:new', { id: offer.id, name: offer.name });

    // Send offer email to all users with email (fire-and-forget)
    db.user.findMany({
      where: { email: { not: null } },
      select: { id: true, email: true, name: true }
    }).then(users => {
      if (users.length > 0) {
        emailService.sendOfferEmail(users, offer);
      }
    }).catch(err => console.error('[email] Offer notification failed:', err));

    res.redirect('/admin/dashboard?tab=offers');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating offer');
  }
}

async function showEditForm(req, res) {
  const id = req.params.id;
  const offer = await db.offer.findUnique({ where: { id } });
  if (!offer) return res.status(404).send('Offer not found');
  res.render('admin/offers/edit', { title: 'Edit Offer', layout: 'layouts/admin', offer });
}

async function editOffer(req, res) {
  try {
    const id = req.params.id;
    const { name, description, active, dishName } = req.body;
    const data = {
      name: name.trim(),
      description: description ? description.trim() : null,
      dishName: dishName ? dishName.trim() : null,
      active: active === 'on' || active === 'true' || active === true
    };
    if (req.file) {
      const offer = await db.offer.findUnique({ where: { id } });
      if (offer && offer.image) {
        await deleteImage(offer.image);
      }
      data.image = req.file.filename;
    }
    await db.offer.update({ where: { id }, data });
    res.redirect('/admin/dashboard?tab=offers');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating offer');
  }
}

async function deleteOffer(req, res) {
  try {
    const id = req.params.id;
    const offer = await db.offer.findUnique({ where: { id } });
    if (offer && offer.image) {
      await deleteImage(offer.image);
    }
    await db.offer.delete({ where: { id } });
    res.redirect('/admin/dashboard?tab=offers');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting offer');
  }
}

module.exports = { upload: imageUpload({ prefix: 'offer' }), listOffers, showAddForm, addOffer, showEditForm, editOffer, deleteOffer };
