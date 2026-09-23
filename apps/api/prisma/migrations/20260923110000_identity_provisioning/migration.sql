-- Support accounts that are not yet linked to personnel and employees created before login provisioning.
ALTER TABLE "User" ADD COLUMN "provisioningOrganisationId" TEXT;
ALTER TABLE "Employee" ALTER COLUMN "userId" DROP NOT NULL;

CREATE INDEX "User_provisioningOrganisationId_idx" ON "User"("provisioningOrganisationId");
CREATE INDEX "Employee_userId_idx" ON "Employee"("userId");

ALTER TABLE "User"
  ADD CONSTRAINT "User_provisioningOrganisationId_fkey"
  FOREIGN KEY ("provisioningOrganisationId") REFERENCES "Organisation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
