-- Backfill existing plans from the employee's manager at migration time.
UPDATE "PerformancePlan" AS p
SET "supervisorId" = e."managerId"
FROM "Employee" AS e
WHERE p."employeeId" = e."id"
  AND p."supervisorId" IS NULL;
