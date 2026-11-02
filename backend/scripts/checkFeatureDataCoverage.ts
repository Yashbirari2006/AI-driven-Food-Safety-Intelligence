import "dotenv/config";
import prisma from "../src/lib/prisma";

const EXPECTED_FEATURE_VERSION = "complaint-ml-features-v1";

const REQUIRED_FEATURE_KEYS = [
  "title",
  "description",
  "foodType",
  "district",
  "establishmentType",
  "photoCount",
  "incidentSubmissionDelayDays",
  "previousComplaintCount",
  "previousComplaints30dCount",
  "verifiedRecordCount",
  "successfulImageAnalysisCount",
];

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

async function main() {
  console.log("\nFOOD SAFETY DATA COVERAGE AUDIT");
  console.log("Mode: READ ONLY\n");

  const [
    totalComplaints,
    linkedComplaints,
    complaintsWithImages,
    totalImages,
    totalTriages,
    totalImageAnalyses,
    establishments,
    verifiedRecords,
    complaints,
    snapshots,
  ] = await Promise.all([
    prisma.complaint.count(),

    prisma.complaint.count({
      where: { establishmentId: { not: null } },
    }),

    prisma.complaint.count({
      where: { images: { some: {} } },
    }),

    prisma.complaintImage.count(),
    prisma.complaintTriage.count(),
    prisma.imageAnalysis.count(),
    prisma.establishment.count(),

    prisma.establishmentRecord.count({
      where: { verified: true },
    }),

    prisma.complaint.findMany({
      select: {
        id: true,
        mlFeatureSnapshot: {
          select: {
            id: true,
            featureVersion: true,
            features: true,
            missingness: true,
            interpretation: true,
            provenance: true,
            capturedAt: true,
          },
        },
      },
      orderBy: { id: "asc" },
    }),

    prisma.complaintMlFeatureSnapshot.findMany({
      select: {
        id: true,
        complaintId: true,
        featureVersion: true,
      },
    }),
  ]);

  const complaintsWithSnapshots = complaints.filter(
    (complaint) => complaint.mlFeatureSnapshot !== null
  );

  const complaintsWithoutSnapshots = complaints.filter(
    (complaint) => complaint.mlFeatureSnapshot === null
  );

  const correctVersionSnapshots = snapshots.filter(
    (snapshot) =>
      snapshot.featureVersion === EXPECTED_FEATURE_VERSION
  );

  const contractChecks = complaintsWithSnapshots.map(
    (complaint) => {
      const snapshot = complaint.mlFeatureSnapshot!;

      const featuresValid = isObject(snapshot.features);
      const missingnessValid = isObject(snapshot.missingness);
      const interpretationValid = isObject(snapshot.interpretation);
      const provenanceValid = isObject(snapshot.provenance);

      const missingFeatureKeys = featuresValid
        ? REQUIRED_FEATURE_KEYS.filter(
            (key) =>
              !Object.prototype.hasOwnProperty.call(
                snapshot.features,
                key
              )
          )
        : [...REQUIRED_FEATURE_KEYS];

      const valid =
        snapshot.featureVersion === EXPECTED_FEATURE_VERSION &&
        featuresValid &&
        missingnessValid &&
        interpretationValid &&
        provenanceValid &&
        missingFeatureKeys.length === 0;

      return {
        complaintId: complaint.id,
        snapshotId: snapshot.id,
        featureVersion: snapshot.featureVersion,
        valid,
        missingFeatureKeys,
        missingnessMetadataValid: missingnessValid,
        interpretationMetadataValid: interpretationValid,
        provenanceMetadataValid: provenanceValid,
        capturedAt: snapshot.capturedAt,
      };
    }
  );

  const validSnapshots = contractChecks.filter(
    (item) => item.valid
  );

  const invalidSnapshots = contractChecks.filter(
    (item) => !item.valid
  );

  console.log("GENERAL COVERAGE");
  console.log({
    totalComplaints,
    linkedComplaints,
    complaintsWithImages,
    totalImages,
    totalTriages,
    totalImageAnalyses,
    establishments,
    verifiedRecords,
  });

  console.log("\nML SNAPSHOT COVERAGE");
  console.log({
    totalComplaints,
    totalSnapshots: snapshots.length,
    complaintsWithSnapshots: complaintsWithSnapshots.length,
    complaintsWithoutSnapshots: complaintsWithoutSnapshots.length,
    correctVersionSnapshots: correctVersionSnapshots.length,
    validSnapshots: validSnapshots.length,
    invalidSnapshots: invalidSnapshots.length,
  });

  console.log("\nCOMPLAINTS WITHOUT SNAPSHOTS");
  console.log(
    complaintsWithoutSnapshots.map((item) => item.id)
  );

  console.log("\nSNAPSHOT CONTRACT VALIDATION");
  console.log(JSON.stringify(contractChecks, null, 2));

  console.log("\nDATA GOVERNANCE NOTES");
  console.log("- This audit is read-only.");
  console.log("- Historical snapshots were not reconstructed.");
  console.log("- Missing values are not treated as zero.");
  console.log("- A valid feature contract does not establish label eligibility.");
  console.log("- No dataset export or model training was performed.");

  console.log("\nAUDIT COMPLETE");
}

main()
  .catch((error) => {
    console.error("Data coverage audit failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });