-- CreateEnum
CREATE TYPE "ComplaintOutcome" AS ENUM ('PENDING', 'SUBSTANTIATED', 'NOT_SUBSTANTIATED', 'INCONCLUSIVE');

-- CreateEnum
CREATE TYPE "OutcomeEvidenceSourceType" AS ENUM ('INSPECTION_FINDING', 'LABORATORY_RESULT', 'VERIFIED_ESTABLISHMENT_RECORD', 'OTHER_VERIFIED_SOURCE');

-- CreateEnum
CREATE TYPE "OutcomeEvidenceVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "ComplaintOutcomeAssessment" (
    "id" SERIAL NOT NULL,
    "complaintId" INTEGER NOT NULL,
    "outcome" "ComplaintOutcome" NOT NULL DEFAULT 'PENDING',
    "determination" TEXT NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "finalizedAt" TIMESTAMP(3),
    "recordedById" INTEGER NOT NULL,
    "finalizedById" INTEGER,
    "labelPolicyVersion" TEXT NOT NULL DEFAULT 'complaint-outcome-v1',
    "supersedesAssessmentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintOutcomeAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintOutcomeEvidence" (
    "id" SERIAL NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "sourceType" "OutcomeEvidenceSourceType" NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "description" TEXT,
    "verificationStatus" "OutcomeEvidenceVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedById" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintOutcomeEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComplaintOutcomeAssessment_supersedesAssessmentId_key" ON "ComplaintOutcomeAssessment"("supersedesAssessmentId");

-- CreateIndex
CREATE INDEX "ComplaintOutcomeAssessment_complaintId_createdAt_idx" ON "ComplaintOutcomeAssessment"("complaintId", "createdAt");

-- CreateIndex
CREATE INDEX "ComplaintOutcomeAssessment_outcome_isFinal_createdAt_idx" ON "ComplaintOutcomeAssessment"("outcome", "isFinal", "createdAt");

-- CreateIndex
CREATE INDEX "ComplaintOutcomeAssessment_recordedById_idx" ON "ComplaintOutcomeAssessment"("recordedById");

-- CreateIndex
CREATE INDEX "ComplaintOutcomeAssessment_finalizedById_idx" ON "ComplaintOutcomeAssessment"("finalizedById");

-- CreateIndex
CREATE INDEX "ComplaintOutcomeEvidence_assessmentId_verificationStatus_idx" ON "ComplaintOutcomeEvidence"("assessmentId", "verificationStatus");

-- CreateIndex
CREATE INDEX "ComplaintOutcomeEvidence_sourceType_sourceReference_idx" ON "ComplaintOutcomeEvidence"("sourceType", "sourceReference");

-- CreateIndex
CREATE INDEX "ComplaintOutcomeEvidence_verifiedById_idx" ON "ComplaintOutcomeEvidence"("verifiedById");

-- AddForeignKey
ALTER TABLE "ComplaintOutcomeAssessment" ADD CONSTRAINT "ComplaintOutcomeAssessment_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintOutcomeAssessment" ADD CONSTRAINT "ComplaintOutcomeAssessment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintOutcomeAssessment" ADD CONSTRAINT "ComplaintOutcomeAssessment_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintOutcomeAssessment" ADD CONSTRAINT "ComplaintOutcomeAssessment_supersedesAssessmentId_fkey" FOREIGN KEY ("supersedesAssessmentId") REFERENCES "ComplaintOutcomeAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintOutcomeEvidence" ADD CONSTRAINT "ComplaintOutcomeEvidence_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ComplaintOutcomeAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintOutcomeEvidence" ADD CONSTRAINT "ComplaintOutcomeEvidence_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
