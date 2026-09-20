/**
 * Script PELIGROSO y MANUAL: borra TODOS los reportes de votación.
 *
 * NO se ejecuta en npm start ni al redesplegar.
 * Solo corre si lo invocas a propósito con confirmación:
 *
 *   CONFIRM_RESET_DB=SI node scripts/reset-db.js
 *
 * Úsalo únicamente en pruebas locales, nunca en producción real por error.
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  if (process.env.CONFIRM_RESET_DB !== 'SI') {
    console.error('Abortado. Para continuar: CONFIRM_RESET_DB=SI node scripts/reset-db.js');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_RESET !== 'SI') {
    console.error(
      'Abortado en production. Si realmente quieres borrar prod: ALLOW_PROD_RESET=SI CONFIRM_RESET_DB=SI node scripts/reset-db.js'
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Falta MONGODB_URI');
  }

  await mongoose.connect(uri);
  const col = mongoose.connection.collection('votereports');
  const before = await col.countDocuments();
  const result = await col.deleteMany({});
  console.log(`Eliminados ${result.deletedCount} de ${before} documentos en votereports`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
