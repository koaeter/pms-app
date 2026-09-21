-- Baseline schema for the PMS application.
-- This migration represents the current Prisma schema and is intended to
-- establish reproducible database deployments from an empty PostgreSQL DB.

CREATE TYPE "CycleStatus" AS ENUM ('DRAFT', 'OPEN', 'REVIEW', 'CLOSED');
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'LOCKED');
CREATE TYPE "PlanItemType" AS ENUM ('KPI', 'COMPETENCY');
CREATE TYPE "AssessorType" AS ENUM ('SELF', 'SUPERVISOR', 'REVIEWER', 'FINAL');
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "link" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId","isRead","createdAt");

CREATE TABLE "Organisation" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organisation_name_key" ON "Organisation"("name");
CREATE UNIQUE INDEX "Organisation_code_key" ON "Organisation"("code");

CREATE TABLE "Employee" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "employeeNumber" TEXT NOT NULL,
  "organisationId" TEXT,
  "designationId" TEXT,
  "departmentId" TEXT,
  "managerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");
CREATE INDEX "Employee_organisationId_idx" ON "Employee"("organisationId");
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");
CREATE INDEX "Employee_managerId_idx" ON "Employee"("managerId");

CREATE TABLE "Department" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "parentId" TEXT,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Department_organisationId_name_key" ON "Department"("organisationId","name");
CREATE UNIQUE INDEX "Department_organisationId_code_key" ON "Department"("organisationId","code");
CREATE INDEX "Department_organisationId_idx" ON "Department"("organisationId");
CREATE INDEX "Department_parentId_idx" ON "Department"("parentId");

CREATE TABLE "Designation" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "grade" TEXT,
  CONSTRAINT "Designation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Designation_organisationId_name_key" ON "Designation"("organisationId","name");
CREATE UNIQUE INDEX "Designation_organisationId_code_key" ON "Designation"("organisationId","code");
CREATE INDEX "Designation_organisationId_idx" ON "Designation"("organisationId");

CREATE TABLE "Role" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

CREATE TABLE "Permission" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

CREATE TABLE "UserRole" (
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

CREATE TABLE "RolePermission" (
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

CREATE TABLE "PerformanceProgramme" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PerformanceProgramme_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PerformanceProgramme_organisationId_code_key" ON "PerformanceProgramme"("organisationId","code");
CREATE INDEX "PerformanceProgramme_organisationId_idx" ON "PerformanceProgramme"("organisationId");

CREATE TABLE "ReviewType" (
  "id" TEXT NOT NULL,
  "programmeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  CONSTRAINT "ReviewType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReviewType_programmeId_code_key" ON "ReviewType"("programmeId","code");
CREATE INDEX "ReviewType_programmeId_idx" ON "ReviewType"("programmeId");

CREATE TABLE "RatingScale" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  CONSTRAINT "RatingScale_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RatingScale_organisationId_name_key" ON "RatingScale"("organisationId","name");
CREATE INDEX "RatingScale_organisationId_idx" ON "RatingScale"("organisationId");

CREATE TABLE "PerformanceCycle" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "programmeId" TEXT NOT NULL,
  "reviewTypeId" TEXT NOT NULL,
  "ratingScaleId" TEXT,
  "name" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "CycleStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PerformanceCycle_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PerformanceCycle_organisationId_idx" ON "PerformanceCycle"("organisationId");
CREATE INDEX "PerformanceCycle_programmeId_idx" ON "PerformanceCycle"("programmeId");
CREATE INDEX "PerformanceCycle_reviewTypeId_idx" ON "PerformanceCycle"("reviewTypeId");
CREATE INDEX "PerformanceCycle_ratingScaleId_idx" ON "PerformanceCycle"("ratingScaleId");

CREATE TABLE "Kpi" (
  "id" TEXT NOT NULL,
  "programmeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "defaultWeight" DECIMAL(5,2),
  CONSTRAINT "Kpi_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Kpi_programmeId_code_key" ON "Kpi"("programmeId","code");
CREATE INDEX "Kpi_programmeId_idx" ON "Kpi"("programmeId");

CREATE TABLE "Competency" (
  "id" TEXT NOT NULL,
  "programmeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "defaultWeight" DECIMAL(5,2),
  CONSTRAINT "Competency_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Competency_programmeId_code_key" ON "Competency"("programmeId","code");
CREATE INDEX "Competency_programmeId_idx" ON "Competency"("programmeId");

CREATE TABLE "PerformancePlan" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "reviewTypeId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "finalAssessorId" TEXT,
  "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PerformancePlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PerformancePlan_employeeId_cycleId_reviewTypeId_key" ON "PerformancePlan"("employeeId","cycleId","reviewTypeId");
CREATE INDEX "PerformancePlan_cycleId_idx" ON "PerformancePlan"("cycleId");
CREATE INDEX "PerformancePlan_employeeId_idx" ON "PerformancePlan"("employeeId");
CREATE INDEX "PerformancePlan_reviewerId_idx" ON "PerformancePlan"("reviewerId");
CREATE INDEX "PerformancePlan_finalAssessorId_idx" ON "PerformancePlan"("finalAssessorId");

CREATE TABLE "PerformancePlanItem" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "type" "PlanItemType" NOT NULL,
  "kpiId" TEXT,
  "competencyId" TEXT,
  "description" TEXT,
  "weight" DECIMAL(5,2) NOT NULL,
  "target" TEXT,
  CONSTRAINT "PerformancePlanItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PerformancePlanItem_planId_idx" ON "PerformancePlanItem"("planId");
CREATE INDEX "PerformancePlanItem_kpiId_idx" ON "PerformancePlanItem"("kpiId");
CREATE INDEX "PerformancePlanItem_competencyId_idx" ON "PerformancePlanItem"("competencyId");

CREATE TABLE "PerformanceAssessment" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "assessorId" TEXT NOT NULL,
  "assessorType" "AssessorType" NOT NULL,
  "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
  "overallScore" DECIMAL(7,2),
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PerformanceAssessment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PerformanceAssessment_planId_assessorId_assessorType_key" ON "PerformanceAssessment"("planId","assessorId","assessorType");
CREATE INDEX "PerformanceAssessment_planId_idx" ON "PerformanceAssessment"("planId");
CREATE INDEX "PerformanceAssessment_assessorId_idx" ON "PerformanceAssessment"("assessorId");

-- RatingLevel depends on RatingScale and is declared separately to keep
-- the baseline dependency ordering explicit.
CREATE TABLE "RatingLevel" (
  "id" TEXT NOT NULL,
  "scaleId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "score" DECIMAL(6,2) NOT NULL,
  "description" TEXT,
  CONSTRAINT "RatingLevel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RatingLevel_scaleId_name_key" ON "RatingLevel"("scaleId","name");
CREATE INDEX "RatingLevel_scaleId_idx" ON "RatingLevel"("scaleId");
ALTER TABLE "RatingLevel" ADD CONSTRAINT "RatingLevel_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "RatingScale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PerformanceAssessmentItem" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "planItemId" TEXT NOT NULL,
  "ratingScaleId" TEXT,
  "ratingLevelId" TEXT,
  "score" DECIMAL(7,2),
  "comment" TEXT,
  CONSTRAINT "PerformanceAssessmentItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PerformanceAssessmentItem_assessmentId_planItemId_key" ON "PerformanceAssessmentItem"("assessmentId","planItemId");
CREATE INDEX "PerformanceAssessmentItem_planItemId_idx" ON "PerformanceAssessmentItem"("planItemId");

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity","entityId");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId","createdAt");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Designation" ADD CONSTRAINT "Designation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceProgramme" ADD CONSTRAINT "PerformanceProgramme_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewType" ADD CONSTRAINT "ReviewType_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "PerformanceProgramme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceCycle" ADD CONSTRAINT "PerformanceCycle_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceCycle" ADD CONSTRAINT "PerformanceCycle_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "PerformanceProgramme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceCycle" ADD CONSTRAINT "PerformanceCycle_reviewTypeId_fkey" FOREIGN KEY ("reviewTypeId") REFERENCES "ReviewType"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "PerformanceCycle" ADD CONSTRAINT "PerformanceCycle_ratingScaleId_fkey" FOREIGN KEY ("ratingScaleId") REFERENCES "RatingScale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RatingScale" ADD CONSTRAINT "RatingScale_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Kpi" ADD CONSTRAINT "Kpi_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "PerformanceProgramme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Competency" ADD CONSTRAINT "Competency_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "PerformanceProgramme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformancePlan" ADD CONSTRAINT "PerformancePlan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformancePlan" ADD CONSTRAINT "PerformancePlan_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PerformanceCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformancePlan" ADD CONSTRAINT "PerformancePlan_reviewTypeId_fkey" FOREIGN KEY ("reviewTypeId") REFERENCES "ReviewType"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "PerformancePlan" ADD CONSTRAINT "PerformancePlan_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PerformancePlan" ADD CONSTRAINT "PerformancePlan_finalAssessorId_fkey" FOREIGN KEY ("finalAssessorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PerformancePlanItem" ADD CONSTRAINT "PerformancePlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PerformancePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformancePlanItem" ADD CONSTRAINT "PerformancePlanItem_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "PerformancePlanItem" ADD CONSTRAINT "PerformancePlanItem_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "PerformanceAssessment" ADD CONSTRAINT "PerformanceAssessment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PerformancePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceAssessment" ADD CONSTRAINT "PerformanceAssessment_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "Employee"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "PerformanceAssessmentItem" ADD CONSTRAINT "PerformanceAssessmentItem_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "PerformanceAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceAssessmentItem" ADD CONSTRAINT "PerformanceAssessmentItem_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "PerformancePlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceAssessmentItem" ADD CONSTRAINT "PerformanceAssessmentItem_ratingScaleId_fkey" FOREIGN KEY ("ratingScaleId") REFERENCES "RatingScale"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "PerformanceAssessmentItem" ADD CONSTRAINT "PerformanceAssessmentItem_ratingLevelId_fkey" FOREIGN KEY ("ratingLevelId") REFERENCES "RatingLevel"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

