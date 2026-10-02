CREATE TABLE "PerformanceAssessmentRevision" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "assessorId" TEXT NOT NULL,
    "assessorType" "AssessorType" NOT NULL,
    "action" TEXT NOT NULL,
    "status" "AssessmentStatus" NOT NULL,
    "overallScore" DECIMAL(7,2),
    "comment" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceAssessmentRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PerformanceAssessmentRevision_assessmentId_createdAt_idx"
    ON "PerformanceAssessmentRevision"("assessmentId", "createdAt");

CREATE INDEX "PerformanceAssessmentRevision_assessorId_createdAt_idx"
    ON "PerformanceAssessmentRevision"("assessorId", "createdAt");

ALTER TABLE "PerformanceAssessmentRevision"
    ADD CONSTRAINT "PerformanceAssessmentRevision_assessmentId_fkey"
    FOREIGN KEY ("assessmentId") REFERENCES "PerformanceAssessment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PerformanceAssessmentRevision"
    ADD CONSTRAINT "PerformanceAssessmentRevision_assessorId_fkey"
    FOREIGN KEY ("assessorId") REFERENCES "Employee"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
