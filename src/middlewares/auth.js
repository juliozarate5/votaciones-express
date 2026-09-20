function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.flash('error', 'Debes iniciar sesión');
    return res.redirect('/login');
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    req.flash('error', 'Debes iniciar sesión');
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'admin') {
    req.flash('error', 'No tienes permiso de administrador');
    return res.redirect('/menu');
  }
  return next();
}

function requireReporter(req, res, next) {
  if (!req.session.user) {
    req.flash('error', 'Debes iniciar sesión');
    return res.redirect('/login');
  }
  if (req.session.user.role === 'admin') {
    // Admin can still report if desired, allow
  }
  return next();
}

function requireApiLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ ok: false, error: 'No autenticado' });
  }
  return next();
}

function requireApiAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ ok: false, error: 'No autenticado' });
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Sin permiso de administrador' });
  }
  return next();
}

module.exports = {
  requireLogin,
  requireAdmin,
  requireReporter,
  requireApiLogin,
  requireApiAdmin,
};
