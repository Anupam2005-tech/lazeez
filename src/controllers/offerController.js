const db = require('../config/db');

async function showOffers(req, res) {
  try {
    const offers = await db.offer.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' }
    });

    // Mark all active offers as viewed in session
    if (!req.session.viewedOfferIds) req.session.viewedOfferIds = [];
    offers.forEach(o => {
      if (!req.session.viewedOfferIds.includes(o.id)) {
        req.session.viewedOfferIds.push(o.id);
      }
    });

    res.render('storefront/offers', {
      title: 'Offers',
      offers
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading offers');
  }
}

async function markViewed(req, res) {
  try {
    const offerId = req.body.offerId;
    if (!req.session.viewedOfferIds) req.session.viewedOfferIds = [];
    if (!req.session.viewedOfferIds.includes(offerId)) {
      req.session.viewedOfferIds.push(offerId);
    }
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
}

async function dismissPopup(req, res) {
  try {
    const offerId = req.body.offerId;
    // Read existing dismissed IDs from cookie
    let dismissedIds = [];
    try {
      const cookieVal = req.cookies?.offer_popup_dismissed;
      if (cookieVal) dismissedIds = JSON.parse(cookieVal);
      if (!Array.isArray(dismissedIds)) dismissedIds = [];
    } catch (e) {
      dismissedIds = [];
    }
    // Add the new offer ID if not already present
    if (!dismissedIds.includes(offerId)) {
      dismissedIds.push(offerId);
    }
    // Set persistent cookie (1 year) so popup never shows again for this offer
    res.cookie('offer_popup_dismissed', JSON.stringify(dismissedIds), {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax'
    });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
}

async function apiCount(req, res) {
  try {
    const viewedIds = req.session.viewedOfferIds || [];
    const activeOffers = await db.offer.findMany({ where: { active: true } });
    // Clean up: only count offers that still exist
    const validViewedIds = viewedIds.filter(id => activeOffers.some(o => o.id === id));
    req.session.viewedOfferIds = validViewedIds;
    const unseenCount = activeOffers.filter(o => !validViewedIds.includes(o.id)).length;
    res.json({ unseenCount, totalCount: activeOffers.length });
  } catch (err) {
    res.json({ unseenCount: 0, totalCount: 0 });
  }
}

module.exports = { showOffers, markViewed, dismissPopup, apiCount };
