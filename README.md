# Performance Management System (PMS)

A configurable electronic Performance Management System for public-sector organizations.

## Architecture

- **Web:** Next.js
- **API:** NestJS
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** Username/password with secure server-side sessions
- **Authorization:** RBAC with permission scopes
- **Workflow:** Configurable approval workflows
- **Audit:** Append-oriented audit trail

## Core domains

1. Identity & authentication
2. Generic organizational hierarchy
3. Designations and reporting relationships
4. Role-based authorization
5. Performance programs, cycles and review types
6. KPIs and competencies
7. Rating scales and scoring
8. Configurable approval workflows
9. Notifications
10. Audit and system administration

## Development

The project is being implemented incrementally. Database and application configuration are intentionally separated so the deployment environment can provide secrets through environment variables.
