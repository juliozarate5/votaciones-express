# Changelog

## 1.1.5 — 2026-09-19

- Offline real en producción: página `/offline.html`, caché de shell, cola con timeout, sync con credenciales.
- Si el servidor no responde (Render/Mongo), los votos se encolan igual que sin red.
- Fix SW: iconos PWA faltantes tumaban `cache.addAll` y el Service Worker no se instalaba.
- SW v12 con caché best-effort e `ignoreSearch` para CSS con `?v=`.

## 1.1.4 — 2026-09-19

- Fix login en Render: `trust proxy`, cookies `sameSite`, `session.save` antes del redirect.
- Service Worker ya no intercepta `/login`, `/menu` ni POST (solo assets estáticos).

## 1.1.3 — 2026-09-19

- Reintentos y reconexión automática a Mongo Atlas (útil con Render free + cold start).
- Endpoint `/health` para keep-alive / monitoreo.
- Si la BD está caída, API `503` y votos encolados offline hasta recuperar.

## 1.1.2 — 2026-09-19

- Protección explícita: el arranque no resetea MongoDB; bloqueo si `RESET_DB`/`DROP_DB` están activos.
- Documentación de persistencia entre redespliegues.
- Script manual de borrado con confirmación (`scripts/reset-db.js`), fuera de `npm start`.

## 1.1.1 — 2026-09-19

- Estilos con Tailwind compilado localmente (sin CDN), para que la UI no quede sin CSS.

## 1.1.0 — 2026-09-19

- Admin: exportar reporte a Excel y PDF.
- Admin: imprimir tabla y dashboard.
- Dashboard estadístico con gráficos por usuario, género y modo de reporte (Chart.js).

## 1.0.0 — 2026-09-19

- Ingreso con nombre libre + código compartido de reporte.
- Acceso admin con usuario fijo `admin` y contraseña de entorno.
- Reporte en tiempo real (mujer/hombre) y reporte de total final.
- Consulta separada de ambos tipos de reporte (propio y admin).
- PWA con cola offline (IndexedDB) y sincronización idempotente.
