-- Preserve the supervisor responsible for a performance plan even if the employee's current manager changes.
ALTER TABLE "PerformancePlan"
ADD COLUMN "supervisorId" TEXT;

CREATE INDEX "PerformancePlan_supervisorId_idx" ON "PerformancePlan"("supervisorId");

ALTER TABLE "PerformancePlan"
ADD CONSTRAINT "PerformancePlan_supervisorId_fkey"
FOREIGN KEY ("supervisorId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
