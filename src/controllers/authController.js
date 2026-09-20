const { roles } = require('../models/Reporter');
const { normalizeReporterName, displayReporterName } = require('../utils/names');

function showLogin(req, res) {
  if (req.session.user) {
    return res.redirect('/menu');
  }
  return res.render('auth/login', { title: 'Ingreso' });
}

function redirectWithSession(req, res, path) {
  // En Render hay que persistir la sesión antes del redirect
  req.session.save((err) => {
    if (err) {
      console.error('Error guardando sesión:', err);
      req.flash('error', 'No se pudo iniciar sesión. Intenta de nuevo.');
      return res.redirect('/login');
    }
    return res.redirect(path);
  });
}

function login(req, res) {
  const name = String(req.body.name || '').trim();
  const code = String(req.body.code || '').trim();

  if (!name || !code) {
    req.flash('error', 'Nombre y código son obligatorios');
    return redirectWithSession(req, res, '/login');
  }

  if (!/^\d+$/.test(code)) {
    req.flash('error', 'El código secreto debe ser numérico');
    return redirectWithSession(req, res, '/login');
  }

  const adminUser = (process.env.ADMIN_USER || 'admin').trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || '').trim();
  const reportCode = String(process.env.REPORT_CODE || '').trim();

  const normalizedName = normalizeReporterName(name);

  if (normalizedName === adminUser) {
    if (code !== adminPassword) {
      req.flash('error', 'Código de administrador incorrecto');
      return redirectWithSession(req, res, '/login');
    }

    req.session.user = {
      name: process.env.ADMIN_NAME || 'Administrador',
      role: roles.ADMIN,
      loginName: adminUser,
      reporterKey: adminUser,
    };
    req.flash('success', 'Bienvenido, administrador');
    return redirectWithSession(req, res, '/menu');
  }

  if (code !== reportCode) {
    req.flash('error', 'Código de reporte incorrecto');
    return redirectWithSession(req, res, '/login');
  }

  const displayName = displayReporterName(name);
  req.session.user = {
    name: displayName,
    role: roles.REPORTER,
    loginName: normalizedName,
    reporterKey: normalizedName,
  };
  req.flash('success', `Hola, ${displayName}`);
  return redirectWithSession(req, res, '/menu');
}

function logout(req, res) {
  req.session.destroy(() => {
    res.redirect('/login');
  });
}

module.exports = {
  showLogin,
  login,
  logout,
};
