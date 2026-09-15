# Performance Management System (PMS)

Configurable electronic Performance Management System for public-sector organisations.

## Current stack
- Web: Next.js
- API: NestJS
- Database: PostgreSQL
- ORM: Prisma
- Authentication: username/password + server-side sessions
- Authorization: RBAC and permission scopes

## Local development
1. Copy `.env.example` to `.env`.
2. Run `docker compose up -d`.
3. Install dependencies with `pnpm install`.
4. Generate Prisma Client with `pnpm db:generate`.
5. Create the database schema with `pnpm db:migrate`.
6. Run the API and web apps with `pnpm dev`.

## Current implementation
Authentication now has password hashing, server-side sessions, login and current-user endpoints. The API also exposes the first system-administration endpoints for roles and permissions. The web application has login and a protected dashboard shell.

The implementation is being built incrementally, with configuration and secrets kept outside source control.
