# FairSplit API

Backend NestJS + TypeScript alineado con la arquitectura limpia (API → application → domain → infra).

## Requisitos

- Node.js 20+
- npm
- (Local) Docker + Docker Compose para la base de datos
- Variables de entorno: ver `.env.example` y crea tu `.env` con al menos `DATABASE_URL`, `PORT`, `CORS_ALLOWED_ORIGINS` (opcional)

## Cómo levantar en local

1) Instalar dependencias  
`npm install`

2) Levantar PostgreSQL local (Docker)  
`npm run db:up`  
Credenciales por defecto: user `billsplitter`, pass `billsplitter`, db `billsplitter_dev`, host `localhost:5432` (configurable en `docker-compose.yml`).

3) Aplicar migraciones y generar cliente Prisma  
`npm run prisma:migrate`  
`npm run prisma:generate`

4) Arrancar el backend  
`npm run start:dev`

## Scripts útiles

- `npm run start:dev` — Nest en modo watch.
- `npm run build` — compila a `dist/`.
- `npm run lint` — lint de `src/` y `test/`.
- `npm run prisma:generate` — regenera el cliente Prisma tras cambios en el schema.
- `npm run prisma:migrate -- --name <nombre>` — crea y aplica una nueva migración en dev.
- `npm run prisma:migrate` — aplica las migraciones pendientes en dev.
- `npm run prisma:migrate:deploy` — aplica migraciones existentes (staging/prod/CI).
- `npm run prisma:migrate:create` — genera archivos de migración sin aplicarlos (útil para revisar diff).
- `npm run prisma:format` — formatea `schema.prisma`.
- `npm run db:up` / `npm run db:logs` — arranca la base en Docker y muestra logs.

## Estructura

- `src/` organizado en capas: `api/`, `application/`, `domain/`, `infra/`, `config/`, `shared/`.
- `prisma/` contiene `schema.prisma` y las migraciones versionadas.
- `docker-compose.yml` levanta la base para dev.

### Nota sobre `prisma/` en la raíz

- Prisma CLI busca por defecto `prisma/schema.prisma` en la raíz; mantenerlo ahí evita banderas extra en scripts y simplifica CI/CD.
- Aunque conceptualmente pertenece a infraestructura, lo tratamos como tooling externo al código de negocio; si algún día se mueve a `infra/prisma`, habría que ajustar los scripts (`"prisma": { "schema": "infra/prisma/schema.prisma" }`) y pipelines.

## Seguridad básica

- `helmet` habilitado en `main.ts`.
- CORS configurable vía `CORS_ALLOWED_ORIGINS` (coma-separados); si no se define, permite todos los orígenes (solo recomendable en dev).
- Rate limiting global con `@nestjs/throttler` (100 req / 60s) en `AppModule`.

## API (resumen)

- `POST /events`, `GET /events`, `GET /events/:id`
- `POST /events/:eventId/participants`, `GET /events/:eventId/participants`, `PATCH /events/:eventId/participants/:participantId`, `DELETE /events/:eventId/participants/:participantId`
- `POST /events/:eventId/invoices`, `GET /events/:eventId/invoices`, `GET /events/:eventId/invoices/:invoiceId`
- `GET /events/:eventId/summary` — saldos
- `GET /events/:eventId/transfers` — transferencias sugeridas
- `GET /events/:eventId/full-summary` — “bento” consolidado

## Contrato de errores

Todas las excepciones pasan por un filtro global y usan un formato uniforme:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid input",
  "fieldErrors": {
    "name": "Name is required"
  },
  "path": "/events",
  "timestamp": "2025-12-04T12:00:00.000Z"
}
```

Códigos frecuentes: `VALIDATION_ERROR`/`BAD_REQUEST` (400), `EVENT_NOT_FOUND`/`PARTICIPANT_NOT_FOUND`/`INVOICE_NOT_FOUND` (404), `PARTICIPANT_HAS_INVOICES` (409), `CONFLICT` (409), `INTERNAL_SERVER_ERROR` (500).
