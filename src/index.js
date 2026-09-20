const path = require('path');
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');

const authRoutes = require('./routes/auth.routes');
const reportRoutes = require('./routes/report.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const { requireLogin } = require('./middlewares/auth');
const menuController = require('./controllers/menuController');
const { pingDatabase, isDatabaseReady, requireDatabase } = require('./configurations/database');

const app = express();

// Render (y otros proxies) terminan HTTPS delante de Node
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '1mb' }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

const useSecureCookies = process.env.COOKIE_SECURE === 'true';

app.use(
  session({
    name: 'votaciones.sid',
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: useSecureCookies,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 12,
    },
  })
);
app.use(flash());

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.info = req.flash('info');
  res.locals.formatDateTime = require('./utils/dates').formatDateTime;
  next();
});

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/menu');
  }
  return res.redirect('/login');
});

// Healthcheck para Render / cron de keep-alive (no borra datos)
app.get('/health', async (req, res) => {
  const dbOk = await pingDatabase();
  res.status(dbOk ? 200 : 503).json({
    ok: dbOk,
    service: 'votaciones',
    db: isDatabaseReady() ? 'up' : 'down',
    uptimeSec: Math.round(process.uptime()),
  });
});

app.use(authRoutes);
app.get('/menu', requireLogin, menuController.showMenu);
// Reset admin necesita DB; va por dashboard routes con requireDatabase
app.use(requireDatabase, reportRoutes);
app.use(requireDatabase, dashboardRoutes);

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'No encontrado' });
  }
  res.status(404).render('errors/404', {
    title: 'No encontrado',
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
  req.flash('error', 'Ocurrió un error inesperado');
  return res.redirect(req.session.user ? '/menu' : '/login');
});

module.exports = app;
