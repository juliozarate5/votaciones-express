# Reporte de Votaciones

App sencilla para reportar votos con **Node.js**, **EJS**, **MongoDB**, **Tailwind (local)** y soporte **PWA/offline**.

## Requisitos

- Node.js 18+
- MongoDB (Atlas u otra instancia)

## Persistencia de datos (redespliegue)

- Los votos se guardan en **MongoDB** (`MONGODB_URI`), no en el disco del servidor de la app.
- **Redeploy / reinicio / `npm start` NO borra ni resetea la base.**
- No hay seed automático ni `dropDatabase` en el arranque.
- Mantén la **misma** `MONGODB_URI` en producción. Si cambias de cluster/base, verás otra base (vacía o distinta), no un “reset” de la anterior.
- Si en el entorno aparece `RESET_DB=true` o `DROP_DB=true`, la app **se niega a arrancar** para proteger los datos.
- Borrado manual (solo pruebas): `CONFIRM_RESET_DB=SI node scripts/reset-db.js` (bloqueado en `production` salvo `ALLOW_PROD_RESET=SI`).

### Render + Mongo Atlas (inactividad)

En el plan gratuito, **Render duerme** el servicio y a veces **Atlas tarda** en aceptar conexiones otra vez. Eso **no borra votos**.

La app ya:
- Reintenta conectar Mongo al arrancar (wake cold start)
- Se reconecta sola si se cae el socket
- Expone `GET /health` para monitoreo / keep-alive
- Si la BD no responde, la API responde `503` y los votos en vivo se **encolan offline** hasta que vuelva

**Recomendaciones en Render:**
1. Variables de entorno: misma `MONGODB_URI` de Atlas, `NODE_ENV=production`, `COOKIE_SECURE=true`, `SESSION_SECRET` fuerte.
2. En Atlas → Network Access: permite `0.0.0.0/0` (o las IPs de Render) para no bloquear el wake.
3. Opcional keep-alive: un cron externo (p. ej. [cron-job.org](https://cron-job.org)) pegando cada 10–14 min a `https://TU-APP.onrender.com/health` para reducir sleeps.
4. Start command: `npm start` (ya construye CSS con `prestart`).

## Configuración

1. Copia `.env.example` a `.env` y completa los valores.
2. Variables importantes:
   - `MONGODB_URI` — conexión a Mongo (**misma URI en cada deploy**)
   - `REPORT_CODE` — código compartido numérico para reporteros
   - `ADMIN_USER` / `ADMIN_PASSWORD` — acceso admin (nombre fijo `admin` por defecto)
   - `SESSION_SECRET` — secreto de cookies de sesión

## Instalación

```bash
npm install
npm start
```

Abre `http://localhost:3000`.

En desarrollo puedes usar:

```bash
npm run dev
```

## Cómo usar

1. **Reportero:** nombre libre + `REPORT_CODE`.
2. **Admin:** nombre `admin` + `ADMIN_PASSWORD`.
3. En el menú puedes:
   - Reportar **voto a voto** (tiempo real)
   - Reportar **total final** (mujeres + hombres = total)
   - Ver **mi reporte** (ambos modos por separado)
   - (Admin) Ver el **reporte de todos** (Excel, PDF, imprimir)
   - (Admin) Abrir el **dashboard** con gráficos por usuario y género

Los modos tiempo real y total final son independientes: uno no reemplaza al otro.

### Exportación admin

- `/dashboard/admin/export/excel` — descarga `.xlsx`
- `/dashboard/admin/export/pdf` — descarga `.pdf`
- Botón **Imprimir** en la tabla y en el dashboard estadístico

## Estilos (Tailwind local)

La app **no usa el CDN** de Tailwind (evita pantallas sin estilo sin internet).

```bash
npm run build:css
```

`npm start` y `npm run dev` ejecutan el build automáticamente.

- La app se puede instalar como PWA.
- Si no hay red o el servidor no responde, los votos se encolan en IndexedDB.
- Al recuperar conexión se sincronizan con `/api/votes/sync` sin duplicar (`clientId` único).

## Estructura

```
server.js
src/
  index.js
  configurations/database.js
  models/
  controllers/
  routes/
  middlewares/
  services/
  views/
  public/
```
