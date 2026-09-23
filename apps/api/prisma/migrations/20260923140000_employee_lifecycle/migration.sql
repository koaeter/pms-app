-- Track employment lifecycle separately from login-account status.
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'EXITED');

ALTER TABLE "Employee"
ADD COLUMN "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE';
