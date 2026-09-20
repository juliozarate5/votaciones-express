require('dotenv').config();
const app = require('./src/index');
const { connectWithRetry } = require('./src/configurations/database');

const PORT = process.env.PORT || 3000;

async function start() {
  // Reintentos: útil cuando Render o Atlas tardan en despertar tras inactividad.
  // Nunca borra datos; solo conecta a MONGODB_URI.
  await connectWithRetry(10);
  app.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
