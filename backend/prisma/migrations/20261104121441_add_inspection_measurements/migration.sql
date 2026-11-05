-- CreateEnum
CREATE TYPE "InspectionMeasurementField" AS ENUM ('HYGIENE_SCORE', 'TEMPERATURE_READING', 'UNSAFE_WATER_INDICATOR', 'PEST_SIGNS', 'CROSS_CONTAMINATION_INDICATOR', 'EXPIRED_FOOD_INDICATOR');

-- CreateEnum
CREATE TYPE "InspectionMeasurementStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "InspectionMeasurement" (
    "id" SERIAL NOT NULL,
    "inspectionId" INTEGER NOT NULL,
    "fieldKey" "InspectionMeasurementField" NOT NULL,
    "value" JSONB NOT NULL,
    "unit" TEXT,
    "method" TEXT NOT NULL,
    "protocolReference" TEXT,
    "sourceReference" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "recordedById" INTEGER NOT NULL,
    "verificationStatus" "InspectionMeasurementStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedById" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "supersedesId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InspectionMeasurement_supersedesId_key" ON "InspectionMeasurement"("supersedesId");

-- CreateIndex
CREATE INDEX "InspectionMeasurement_inspectionId_verificationStatus_idx" ON "InspectionMeasurement"("inspectionId", "verificationStatus");

-- CreateIndex
CREATE INDEX "InspectionMeasurement_recordedById_idx" ON "InspectionMeasurement"("recordedById");

-- CreateIndex
CREATE INDEX "InspectionMeasurement_verifiedById_idx" ON "InspectionMeasurement"("verifiedById");

-- CreateIndex
CREATE INDEX "InspectionMeasurement_fieldKey_createdAt_idx" ON "InspectionMeasurement"("fieldKey", "createdAt");

-- AddForeignKey
ALTER TABLE "InspectionMeasurement" ADD CONSTRAINT "InspectionMeasurement_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionMeasurement" ADD CONSTRAINT "InspectionMeasurement_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionMeasurement" ADD CONSTRAINT "InspectionMeasurement_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionMeasurement" ADD CONSTRAINT "InspectionMeasurement_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "InspectionMeasurement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
