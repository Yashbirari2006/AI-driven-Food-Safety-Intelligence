-- CreateTable
CREATE TABLE "ComplaintMlFeatureSnapshot" (
    "id" SERIAL NOT NULL,
    "complaintId" INTEGER NOT NULL,
    "featureVersion" TEXT NOT NULL,
    "features" JSONB NOT NULL,
    "missingness" JSONB NOT NULL,
    "interpretation" JSONB NOT NULL,
    "provenance" JSONB NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintMlFeatureSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComplaintMlFeatureSnapshot_complaintId_key" ON "ComplaintMlFeatureSnapshot"("complaintId");

-- CreateIndex
CREATE INDEX "ComplaintMlFeatureSnapshot_featureVersion_capturedAt_idx" ON "ComplaintMlFeatureSnapshot"("featureVersion", "capturedAt");

-- AddForeignKey
ALTER TABLE "ComplaintMlFeatureSnapshot" ADD CONSTRAINT "ComplaintMlFeatureSnapshot_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
