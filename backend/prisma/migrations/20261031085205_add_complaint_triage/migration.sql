-- CreateEnum
CREATE TYPE "TriageUrgency" AS ENUM ('URGENT', 'HIGH', 'NORMAL');

-- CreateEnum
CREATE TYPE "TriageActionability" AS ENUM ('ACTIONABLE', 'NEEDS_INFORMATION', 'REVIEW_REQUIRED');

-- CreateTable
CREATE TABLE "ComplaintTriage" (
    "id" SERIAL NOT NULL,
    "complaintId" INTEGER NOT NULL,
    "urgency" "TriageUrgency" NOT NULL,
    "actionability" "TriageActionability" NOT NULL,
    "reasons" JSONB NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintTriage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplaintTriage_complaintId_assessedAt_idx" ON "ComplaintTriage"("complaintId", "assessedAt");

-- CreateIndex
CREATE INDEX "ComplaintTriage_urgency_assessedAt_idx" ON "ComplaintTriage"("urgency", "assessedAt");

-- AddForeignKey
ALTER TABLE "ComplaintTriage" ADD CONSTRAINT "ComplaintTriage_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
