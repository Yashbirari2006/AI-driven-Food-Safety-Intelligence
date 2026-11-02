
import "dotenv/config";
import prisma from "../src/lib/prisma";
import {
  buildComplaintMlFeatureVector,
  COMPLAINT_ML_FEATURE_CONTRACT,
} from "../src/services/complaintMlFeatureService";

async function main() {
  const complaints = await prisma.complaint.findMany({
    select: { id: true },
    orderBy: { id: "asc" },
  });

  let passed = 0;
  let failed = 0;

  console.log("Complaint ML feature contract:");
  console.table(COMPLAINT_ML_FEATURE_CONTRACT);

  for (const complaint of complaints) {
    try {
      const result = await buildComplaintMlFeatureVector(complaint.id);

      const hasNoWorkflowLeakage =
        !("status" in result.features);

      const hasNoTriageLeakage =
        !("urgency" in result.features) &&
        !("actionability" in result.features);

      const hasNoInspectionModelInputs =
        !("hygiene_score" in result.features) &&
        !("temperature_control_deviation" in result.features);

      const hasCorrectMissingness =
        result.features.previousComplaintCount === null
          ? result.missingness.establishmentLinkMissing
          : true;

      const valid =
        hasNoWorkflowLeakage &&
        hasNoTriageLeakage &&
        hasNoInspectionModelInputs &&
        hasCorrectMissingness &&
        result.interpretation.predictionPermitted === false;

      if (!valid) {
        failed++;
        console.error(`Complaint ${complaint.id}: FAILED`);
        continue;
      }

      passed++;

      console.log({
        complaintId: complaint.id,
        featureVersion: result.featureVersion,
        district: result.features.district,
        photoCount: result.features.photoCount,
        previousComplaintCount:
          result.features.previousComplaintCount,
        verifiedRecordCount: result.features.verifiedRecordCount,
        missingness: result.missingness,
        predictionPermitted:
          result.interpretation.predictionPermitted,
        test: "PASSED",
      });
    } catch (error) {
      failed++;
      console.error(`Complaint ${complaint.id} failed:`, error);
    }
  }

  console.log("\n========== ML FEATURE CONTRACT TEST ==========");
  console.log({
    total: complaints.length,
    passed,
    failed,
  });

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Feature contract test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
