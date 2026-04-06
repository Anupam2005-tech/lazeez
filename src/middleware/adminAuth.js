const requireAdmin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/admin/login');
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).send('Forbidden: Admins Only');
  }
  next();
};

module.exports = { requireAdmin };
