const { roles } = require('../models/Reporter');
const { normalizeReporterName, displayReporterName } = require('../utils/names');

function showLogin(req, res) {
  if (req.session.user) {
    return res.redirect('/menu');
  }
  return res.render('auth/login', { title: 'Ingreso' });
}

function login(req, res) {
  const name = String(req.body.name || '').trim();
  const code = String(req.body.code || '').trim();

  if (!name || !code) {
    req.flash('error', 'Nombre y código son obligatorios');
    return res.redirect('/login');
  }

  if (!/^\d+$/.test(code)) {
    req.flash('error', 'El código secreto debe ser numérico');
    return res.redirect('/login');
  }

  const adminUser = (process.env.ADMIN_USER || 'admin').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  const reportCode = process.env.REPORT_CODE || '';

  const normalizedName = normalizeReporterName(name);

  if (normalizedName === adminUser) {
    if (code !== adminPassword) {
      req.flash('error', 'Código de administrador incorrecto');
      return res.redirect('/login');
    }

    req.session.user = {
      name: process.env.ADMIN_NAME || 'Administrador',
      role: roles.ADMIN,
      loginName: adminUser,
      reporterKey: adminUser,
    };
    req.flash('success', 'Bienvenido, administrador');
    return res.redirect('/menu');
  }

  if (code !== reportCode) {
    req.flash('error', 'Código de reporte incorrecto');
    return res.redirect('/login');
  }

  const displayName = displayReporterName(name);
  req.session.user = {
    name: displayName,
    role: roles.REPORTER,
    loginName: normalizedName,
    reporterKey: normalizedName,
  };
  req.flash('success', `Hola, ${displayName}`);
  return res.redirect('/menu');
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
