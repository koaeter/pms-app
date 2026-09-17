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
5. Create/update the database schema with `pnpm db:migrate`.
6. Run the API and web apps with `pnpm dev`.

## Current implementation
- Username/password authentication with scrypt password hashing and server-side sessions.
- Global API session guard, with public login and health endpoints.
- RBAC permissions for identity, organisation, performance, reporting and audit functions.
- Organisation administration: create/edit organisations and activate/deactivate them.
- Organisation-level tenant scoping for organisation, performance and reporting APIs.
- Department hierarchy with parent/child relationships.
- Designation and grade management.
- User-to-employee assignment with employee numbers.
- Manager/reporting-line assignment within an organisation.
- Configurable performance programmes.
- Review types attached to programmes.
- Performance cycles with lifecycle status and date ranges.
- KPI and competency libraries with default weights.
- Configurable rating scales and rating levels.
- Employee performance plans containing weighted KPI/competency items and targets.
- Self, supervisor, reviewer and final assessment workflow.
- Assessment stage ownership and workflow guards.
- In-app workflow notifications with unread/read tracking.
- Performance administration UI at `/admin/performance`.
- Organisation administration UI at `/admin/organisation`.
- User/role administration UI at `/admin/users`.
- Audit log UI at `/admin/audit`.
- Performance reporting API for organisation summaries and employee performance history.
- Performance reporting UI at `/admin/reports`.
- Employee performance history and supervisor review queues.

## Administration flow
1. Create or select an organisation.
2. Configure departments and their hierarchy.
3. Configure designations/grades.
4. Create user accounts and assign roles.
5. Link users to employee records and assign managers.
6. Configure a performance programme, review types, KPI/competency libraries and rating scales.
7. Create performance cycles and then create employee performance plans.
8. Manage assessments through the defined workflow stages.
9. Review organisation performance through the reporting dashboard.

## Performance architecture
A performance programme defines reusable rules and content for an organisation. A programme can contain multiple review types, KPI definitions and competency definitions. A cycle activates a programme for a defined period. An employee then receives a performance plan for that cycle/review type, containing weighted KPI and competency items. Assessments can subsequently be recorded by self, supervisor, reviewer and final assessors. Reporting aggregates plan status and approved final assessment results without changing the underlying performance records.

Performance data is organisation-scoped at the API boundary. System administrators can operate across organisations, while organisation-scoped administrators are restricted to their assigned organisation. Employees and supervisors are restricted to records associated with their own employee/reporting relationships.

The implementation is being built incrementally, with configuration and secrets kept outside source control.
