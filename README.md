# FairSplit API (skeleton)

Back-end NestJS + TypeScript skeleton aligned with the clean architecture plan (API → application → domain → infra).

## Requisitos

- Node.js 20+
- npm
- Variables de entorno (`.env`): `DATABASE_URL`, `PORT`.

## Scripts

- `npm run start:dev`: arranca el servidor en modo watch.
- `npm run build`: compila a `dist/`.
- `npm run lint`: linting de `src/` y `test/`.
- `npm run prisma:generate`: genera cliente Prisma.
- `npm run prisma:migrate`: aplica migraciones de Prisma (entorno local/dev).

## Estructura

- `src/` organizado en capas: `api/`, `application/`, `domain/`, `infra/`, `config/`, `shared/`.
- `prisma/` para `schema.prisma` y migraciones.
- `test/` para unit y e2e.

### Nota sobre `prisma/` en la raíz

- Prisma CLI espera por defecto `prisma/schema.prisma` en la raíz; mantenerlo ahí evita banderas adicionales en scripts y simplifica CI/CD.
- Aunque conceptualmente pertenece a infraestructura, lo tratamos como asset de tooling externo al código ejecutable (por eso no está dentro de `src/`). Si algún día se mueve a `infra/prisma`, habría que ajustar los scripts (`"prisma": { "schema": "infra/prisma/schema.prisma" }`) y rutas en CI.

## Seguridad básica (bootstrap)

- `helmet` habilitado en `main.ts` para hardening de cabeceras HTTP.
- CORS configurado desde `CORS_ALLOWED_ORIGINS` (coma-separados); si no se define, permite todos los orígenes (útil solo para dev).
- Rate limiting global con `@nestjs/throttler` (100 req / 60s por defecto) configurado en `AppModule`.

## API inicial

- `POST /events`: crea evento con `{ name, currency }`.
  - Validaciones: `name` requerido (no vacío) y `currency` dentro de `COP | USD | EUR`.
  - Respuestas:
    - `201` con `{ id, name, currency, createdAt }` en éxito.
    - `400` con `{ code: "VALIDATION_ERROR", message, fieldErrors }` en errores de entrada.
- `GET /events`: lista eventos (`[{ id, name, currency, createdAt? }]`). Devuelve `[]` si no hay.
- `GET /events/:id`: devuelve un evento; `404` con error estructurado si no existe.
- `POST /events/:eventId/participants`: crea participante (`name` requerido) asociado a un evento. `404` si no existe el evento.
- `GET /events/:eventId/participants`: lista participantes de un evento. `404` si no existe el evento.
- `PATCH /events/:eventId/participants/:participantId`: actualiza nombre. `404` si no existe evento/participante, `400` si nombre vacío.
- `DELETE /events/:eventId/participants/:participantId`: elimina participante solo si no tiene facturas asociadas (pagador o participación); si las tiene responde `400` con código `PARTICIPANT_HAS_INVOICES`.
- `POST /events/:eventId/invoices`: crea factura con reparto `equal` o `consumption`, soporta `tipAmount` y `birthdayPersonId`. Valida participantes del evento, que el pagador sea participante, sumas de consumos (±0.01), y redistribuye consumo del cumpleañero. Responde `201` con participaciones calculadas.

## Próximos pasos

- Definir modelos en `prisma/schema.prisma`.
- Implementar casos de uso, repositorios y controladores siguiendo los puertos definidos.
