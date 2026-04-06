const db = require('../config/db');

// GET /addresses — list user's saved addresses
async function list(req, res) {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not logged in' });

    const addresses = await db.savedAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
    });

    // If no saved addresses, create one from legacy user address fields
    if (addresses.length === 0) {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (user && user.address) {
        const addr = await db.savedAddress.create({
          data: {
            userId,
            label: 'Home',
            flatNo: user.flatNo,
            address: user.address,
            landmark: user.landmark,
            pincode: user.pincode,
            lat: user.lat,
            lng: user.lng,
            isDefault: true
          }
        });
        return res.json([addr]);
      }
    }

    res.json(addresses);
  } catch (err) {
    console.error('Address list error:', err);
    res.status(500).json({ error: 'Failed to load addresses' });
  }
}

// POST /addresses — create new saved address
async function create(req, res) {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not logged in' });

    const { label, flatNo, address, landmark, pincode, lat, lng, isDefault } = req.body;
    if (!address) return res.status(400).json({ error: 'Address is required' });

    // If this is set as default, unset all others
    if (isDefault) {
      await db.savedAddress.updateMany({
        where: { userId },
        data: { isDefault: false }
      });
    }

    const saved = await db.savedAddress.create({
      data: {
        userId,
        label: label || 'Home',
        flatNo: flatNo || null,
        address,
        landmark: landmark || null,
        pincode: pincode || null,
        lat: lat || null,
        lng: lng || null,
        isDefault: isDefault || false
      }
    });

    // Also update legacy user address fields
    if (isDefault) {
      await db.user.update({
        where: { id: userId },
        data: { flatNo, address, landmark, pincode, lat, lng }
      });
    }

    res.json(saved);
  } catch (err) {
    console.error('Address create error:', err);
    res.status(500).json({ error: 'Failed to save address' });
  }
}

// PUT /addresses/:id — update saved address
async function update(req, res) {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not logged in' });

    const id = req.params.id;
    const { label, flatNo, address, landmark, pincode, lat, lng, isDefault } = req.body;

    // Verify ownership
    const existing = await db.savedAddress.findFirst({ where: { id, userId } });
    if (!existing) return res.status(404).json({ error: 'Address not found' });

    if (isDefault) {
      await db.savedAddress.updateMany({
        where: { userId },
        data: { isDefault: false }
      });
    }

    const updated = await db.savedAddress.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(flatNo !== undefined && { flatNo }),
        ...(address !== undefined && { address }),
        ...(landmark !== undefined && { landmark }),
        ...(pincode !== undefined && { pincode }),
        ...(lat !== undefined && { lat: lat || null }),
        ...(lng !== undefined && { lng: lng || null }),
        ...(isDefault !== undefined && { isDefault })
      }
    });

    // Update legacy user fields if this is the default
    if (isDefault || existing.isDefault) {
      const addr = isDefault ? updated : existing;
      await db.user.update({
        where: { id: userId },
        data: {
          flatNo: updated.flatNo,
          address: updated.address,
          landmark: updated.landmark,
          pincode: updated.pincode,
          lat: updated.lat,
          lng: updated.lng
        }
      });
    }

    res.json(updated);
  } catch (err) {
    console.error('Address update error:', err);
    res.status(500).json({ error: 'Failed to update address' });
  }
}

// DELETE /addresses/:id — delete saved address
async function remove(req, res) {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not logged in' });

    const id = req.params.id;
    const existing = await db.savedAddress.findFirst({ where: { id, userId } });
    if (!existing) return res.status(404).json({ error: 'Address not found' });

    await db.savedAddress.delete({ where: { id } });

    // If deleted was default, make another one default
    if (existing.isDefault) {
      const next = await db.savedAddress.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
      if (next) {
        await db.savedAddress.update({
          where: { id: next.id },
          data: { isDefault: true }
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Address delete error:', err);
    res.status(500).json({ error: 'Failed to delete address' });
  }
}

// PUT /addresses/:id/set-default — set address as default
async function setDefault(req, res) {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not logged in' });

    const id = req.params.id;
    const existing = await db.savedAddress.findFirst({ where: { id, userId } });
    if (!existing) return res.status(404).json({ error: 'Address not found' });

    await db.savedAddress.updateMany({ where: { userId }, data: { isDefault: false } });
    const updated = await db.savedAddress.update({ where: { id }, data: { isDefault: true } });

    // Update legacy user fields
    await db.user.update({
      where: { id: userId },
      data: {
        flatNo: updated.flatNo,
        address: updated.address,
        landmark: updated.landmark,
        pincode: updated.pincode,
        lat: updated.lat,
        lng: updated.lng
      }
    });

    res.json(updated);
  } catch (err) {
    console.error('Set default error:', err);
    res.status(500).json({ error: 'Failed to set default' });
  }
}

module.exports = { list, create, update, remove, setDefault };
