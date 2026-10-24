-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('PROVISIONAL', 'COMPLETED', 'INSUFFICIENT_EVIDENCE', 'FAILED');

-- CreateEnum
CREATE TYPE "EvidenceQuality" AS ENUM ('INSUFFICIENT', 'LIMITED', 'MODERATE', 'STRONG');

-- CreateEnum
CREATE TYPE "ImageProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "establishmentId" INTEGER;

-- CreateTable
CREATE TABLE "Establishment" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "establishmentType" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "district" TEXT,
    "licenseNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Establishment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintImage" (
    "id" SERIAL NOT NULL,
    "complaintId" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "processingStatus" "ImageProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageAnalysis" (
    "id" SERIAL NOT NULL,
    "imageId" INTEGER NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL,
    "findings" JSONB,
    "uncertaintyNote" TEXT,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstablishmentRecord" (
    "id" SERIAL NOT NULL,
    "establishmentId" INTEGER NOT NULL,
    "recordType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceReference" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstablishmentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" SERIAL NOT NULL,
    "complaintId" INTEGER NOT NULL,
    "riskScore" DOUBLE PRECISION,
    "riskLevel" "RiskLevel",
    "status" "AssessmentStatus" NOT NULL DEFAULT 'PROVISIONAL',
    "evidenceQuality" "EvidenceQuality" NOT NULL DEFAULT 'INSUFFICIENT',
    "contributingFactors" JSONB,
    "evidenceSnapshot" JSONB,
    "modelVersions" JSONB,
    "humanReviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" SERIAL NOT NULL,
    "complaintId" INTEGER NOT NULL,
    "establishmentId" INTEGER,
    "assignedOfficerId" INTEGER,
    "status" "InspectionStatus" NOT NULL DEFAULT 'ASSIGNED',
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "findings" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SLARecord" (
    "id" SERIAL NOT NULL,
    "complaintId" INTEGER NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "policyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SLARecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER,
    "complaintId" INTEGER,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Establishment_licenseNumber_key" ON "Establishment"("licenseNumber");

-- CreateIndex
CREATE INDEX "Establishment_name_idx" ON "Establishment"("name");

-- CreateIndex
CREATE INDEX "Establishment_district_idx" ON "Establishment"("district");

-- CreateIndex
CREATE UNIQUE INDEX "ComplaintImage_storageKey_key" ON "ComplaintImage"("storageKey");

-- CreateIndex
CREATE INDEX "ComplaintImage_complaintId_idx" ON "ComplaintImage"("complaintId");

-- CreateIndex
CREATE INDEX "ImageAnalysis_imageId_idx" ON "ImageAnalysis"("imageId");

-- CreateIndex
CREATE INDEX "EstablishmentRecord_establishmentId_occurredAt_idx" ON "EstablishmentRecord"("establishmentId", "occurredAt");

-- CreateIndex
CREATE INDEX "EstablishmentRecord_verified_idx" ON "EstablishmentRecord"("verified");

-- CreateIndex
CREATE INDEX "RiskAssessment_complaintId_assessedAt_idx" ON "RiskAssessment"("complaintId", "assessedAt");

-- CreateIndex
CREATE INDEX "RiskAssessment_riskLevel_assessedAt_idx" ON "RiskAssessment"("riskLevel", "assessedAt");

-- CreateIndex
CREATE INDEX "Inspection_complaintId_idx" ON "Inspection"("complaintId");

-- CreateIndex
CREATE INDEX "Inspection_assignedOfficerId_status_idx" ON "Inspection"("assignedOfficerId", "status");

-- CreateIndex
CREATE INDEX "SLARecord_deadlineAt_completedAt_idx" ON "SLARecord"("deadlineAt", "completedAt");

-- CreateIndex
CREATE INDEX "SLARecord_complaintId_idx" ON "SLARecord"("complaintId");

-- CreateIndex
CREATE INDEX "AuditLog_complaintId_createdAt_idx" ON "AuditLog"("complaintId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "Complaint_establishmentId_idx" ON "Complaint"("establishmentId");

-- CreateIndex
CREATE INDEX "Complaint_createdAt_idx" ON "Complaint"("createdAt");

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintImage" ADD CONSTRAINT "ComplaintImage_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageAnalysis" ADD CONSTRAINT "ImageAnalysis_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ComplaintImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstablishmentRecord" ADD CONSTRAINT "EstablishmentRecord_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_assignedOfficerId_fkey" FOREIGN KEY ("assignedOfficerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLARecord" ADD CONSTRAINT "SLARecord_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
