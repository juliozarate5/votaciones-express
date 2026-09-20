const mongoose = require('mongoose');

/**
 * Conexión a MongoDB (Atlas).
 *
 * Persistencia:
 * - Solo conecta; nunca borra datos.
 * - Render al “dormir” por inactividad NO borra Mongo Atlas.
 * - Al despertar, Mongoose se reconecta solo a la misma MONGODB_URI.
 */
let listenersBound = false;

function bindConnectionListeners() {
  if (listenersBound) return;
  listenersBound = true;

  mongoose.connection.on('connected', () => {
    console.log(`MongoDB conectado (base: ${mongoose.connection.name})`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB desconectado — Mongoose reintentará automáticamente');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconectado');
  });

  mongoose.connection.on('error', (err) => {
    console.error('Error de MongoDB:', err.message);
  });
}

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Falta MONGODB_URI en el archivo .env / variables de Render');
  }

  if (process.env.RESET_DB === 'true' || process.env.DROP_DB === 'true') {
    throw new Error(
      'RESET_DB/DROP_DB está activo. Se bloqueó el arranque para proteger los datos. ' +
        'Quita esas variables del entorno.'
    );
  }

  mongoose.set('strictQuery', true);
  bindConnectionListeners();

  // Si ya hay conexión abierta, no reconectar desde cero
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  await mongoose.connect(uri, {
    autoIndex: process.env.NODE_ENV !== 'production',
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 20000,
    socketTimeoutMS: 45000,
    heartbeatFrequencyMS: 10000,
    // Reintentos de selección de servidor (útil tras wake de Render/Atlas)
    retryWrites: true,
  });

  console.log(
    `MongoDB listo (base: ${mongoose.connection.name}) — datos persistentes entre caídas por inactividad`
  );
  return mongoose.connection;
}

async function connectWithRetry(maxAttempts = 10) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await connectDatabase();
      return;
    } catch (err) {
      lastError = err;
      const waitMs = Math.min(1000 * 2 ** attempt, 30000);
      console.error(
        `Conexión Mongo intento ${attempt}/${maxAttempts} falló: ${err.message}. Reintento en ${waitMs}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

async function pingDatabase() {
  if (!isDatabaseReady()) {
    try {
      await connectDatabase();
    } catch {
      return false;
    }
  }
  try {
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}

function requireDatabase(req, res, next) {
  if (isDatabaseReady()) {
    return next();
  }

  // Intento rápido de reconexión en segundo plano para la siguiente petición
  connectDatabase().catch(() => {});

  if (req.path.startsWith('/api/')) {
    return res.status(503).json({
      ok: false,
      error: 'Base de datos temporalmente no disponible. Reintenta en unos segundos.',
      retry: true,
    });
  }

  req.flash(
    'error',
    'El servidor de datos se está despertando. Espera unos segundos y vuelve a intentar.'
  );
  return res.redirect(req.session?.user ? '/menu' : '/login');
}

module.exports = {
  connectDatabase,
  connectWithRetry,
  isDatabaseReady,
  pingDatabase,
  requireDatabase,
};
