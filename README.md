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

## Próximos pasos

- Definir modelos en `prisma/schema.prisma`.
- Implementar casos de uso, repositorios y controladores siguiendo los puertos definidos.
