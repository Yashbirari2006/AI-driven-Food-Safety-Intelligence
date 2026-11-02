
import prisma from "../src/lib/prisma";
import {
  buildComplaintMlFeatureVectorV2,
  COMPLAINT_ML_FEATURE_VERSION_V2,
} from "../src/services/complaintMlFeatureServiceV2";

const EXPECTED_FEATURES = [
  "title",
  "description",
  "foodType",
  "district",
  "establishmentType",
  "photoCount",
  "incidentSubmissionDelayDays",
  "previousComplaintCount",
  "previousComplaints30dCount",
] as const;

async function main() {
  console.log("Starting Complaint ML Feature V2 read-only test...\n");

  const complaints = await prisma.complaint.findMany({
    select: {
      id: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  console.log(`Complaints found: ${complaints.length}\n`);

  let passed = 0;
  let failed = 0;

  for (const complaint of complaints) {
    try {
      const vector = await buildComplaintMlFeatureVectorV2(
        complaint.id
      );

      const errors: string[] = [];

      if (vector.featureVersion !== COMPLAINT_ML_FEATURE_VERSION_V2) {
        errors.push("Incorrect feature version");
      }

      for (const featureName of EXPECTED_FEATURES) {
        if (!(featureName in vector.features)) {
          errors.push(`Missing feature: ${featureName}`);
        }
      }

      if (
        vector.features.district !== null ||
        vector.features.establishmentType !== null
      ) {
        errors.push(
          "Post-submission establishment context must remain null"
        );
      }

      if (
        vector.features.previousComplaintCount !== null ||
        vector.features.previousComplaints30dCount !== null
      ) {
        errors.push(
          "Previous complaint counts must remain null without a submission-time establishment link"
        );
      }

      if (
        !Number.isSafeInteger(vector.features.photoCount) ||
        vector.features.photoCount < 0
      ) {
        errors.push("photoCount must be a non-negative integer");
      }

      const incidentDelay =
        vector.features.incidentSubmissionDelayDays;

      if (
        incidentDelay !== null &&
        (!Number.isSafeInteger(incidentDelay) || incidentDelay < 0)
      ) {
        errors.push(
          "incidentSubmissionDelayDays must be null or a non-negative integer"
        );
      }

      if (
        vector.missingness.establishmentLinkMissingAtSubmission !== true ||
        vector.missingness.districtMissing !== true ||
        vector.missingness.establishmentTypeMissing !== true ||
        vector.missingness.establishmentHistoryMissing !== true
      ) {
        errors.push(
          "Submission-time establishment missingness flags are inconsistent"
        );
      }

      if (
        vector.missingness.incidentSubmissionDelayMissing !==
        (incidentDelay === null)
      ) {
        errors.push(
          "Incident delay missingness flag does not match the feature value"
        );
      }

      if (vector.interpretation.predictionPermitted !== false) {
        errors.push("Prediction must remain disabled");
      }

      if (
        vector.interpretation.complaintReportsAreUnverified !== true
      ) {
        errors.push(
          "Complaint reports must be explicitly treated as unverified"
        );
      }

      if (
        vector.interpretation.establishmentIdentityResolvedAtSubmission !==
        false
      ) {
        errors.push(
          "Establishment identity must not be treated as resolved at submission"
        );
      }

      if (vector.provenance.snapshotPolicy !== "SUBMISSION_TIME") {
        errors.push("Incorrect snapshot policy");
      }

      if (
        vector.provenance.establishmentContextPolicy !==
        "NO_POST_SUBMISSION_LINKS"
      ) {
        errors.push("Incorrect establishment context policy");
      }

      if (
        vector.provenance.imageCutoff !==
        "UPLOADED_AT_LESS_THAN_OR_EQUAL_TO_COMPLAINT_CREATED_AT"
      ) {
        errors.push("Incorrect image timestamp cutoff");
      }

      if (errors.length > 0) {
        failed++;

        console.error(`FAIL — Complaint #${complaint.id}`);

        for (const error of errors) {
          console.error(`  - ${error}`);
        }
      } else {
        passed++;
        console.log(
          `PASS — Complaint #${complaint.id} | photos=${vector.features.photoCount} | incidentDelay=${vector.features.incidentSubmissionDelayDays}`
        );
      }
    } catch (error) {
      failed++;

      console.error(`ERROR — Complaint #${complaint.id}`);

      console.error(
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log("\n========== TEST SUMMARY ==========");
  console.log(`Total complaints: ${complaints.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log("Database writes performed: 0");
  console.log("==================================");

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("V2 test execution failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
