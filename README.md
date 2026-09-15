# Performance Management System (PMS)

Configurable electronic Performance Management System for public-sector organisations.

## Current stack
- Web: Next.js
- API: NestJS
- Database: PostgreSQL
- ORM: Prisma
- Authentication: username/password + server-side sessions
- Authorization foundation: RBAC and permission scopes

## Local development
1. Copy `.env.example` to `.env`.
2. Run `docker compose up -d`.
3. Install dependencies with `pnpm install`.
4. Generate Prisma Client with `pnpm db:generate`.
5. Create the database schema with `pnpm db:migrate`.
6. Run the API and web apps with `pnpm dev`.

## Current implementation
- Username/password authentication with scrypt password hashing and server-side sessions.
- Global API session guard, with public login and health endpoints.
- Generic organisation, department, designation, employee and reporting structure.
- Configurable performance programmes.
- Review types attached to programmes.
- Performance cycles with lifecycle status.
- KPI and competency libraries.
- Configurable rating scales and rating levels.
- Employee performance plans containing weighted KPI/competency items and targets.
- Initial performance plan submission workflow.
- Performance administration UI at `/admin/performance`.

## Performance architecture
A performance programme defines reusable rules and content for an organisation. A programme can contain multiple review types, KPI definitions and competency definitions. A cycle activates a programme for a defined period. An employee then receives a performance plan for that cycle/review type, containing weighted KPI and competency items. Assessments can subsequently be recorded by self, supervisor, reviewer and final assessors.

The implementation is being built incrementally, with configuration and secrets kept outside source control.
