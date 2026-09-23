-- Snapshot the organisation at audit-event creation time.
ALTER TABLE "AuditLog"
ADD COLUMN "organisationId" TEXT;

CREATE INDEX "AuditLog_organisationId_createdAt_idx" ON "AuditLog"("organisationId", "createdAt");
