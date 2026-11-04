import prisma from "../src/lib/prisma";
import {
  createComplaintMlSnapshotHash,
} from "../src/services/complaintMlSnapshotIntegrityService";

async function main() {
  const snapshotId = 4;

  console.log("COMPLAINT ML SNAPSHOT INTEGRITY VERIFICATION");
  console.log("--------------------------------------------");
  console.log(`Snapshot ID: ${snapshotId}`);
  console.log("Mode: READ ONLY\n");

  const snapshot =
    await prisma.complaintMlFeatureSnapshot.findUnique({
      where: { id: snapshotId },
      select: {
        id: true,
        complaintId: true,
        featureVersion: true,
        features: true,
        missingness: true,
        interpretation: true,
        provenance: true,
        integrityHash: true,
      },
    });

  if (!snapshot) {
    console.error("RESULT: SNAPSHOT NOT FOUND");
    process.exitCode = 1;
    return;
  }

  if (!snapshot.integrityHash) {
    console.error("RESULT: NO STORED HASH");
    console.error("A comparison cannot be performed.");
    process.exitCode = 1;
    return;
  }

  const calculatedHash = createComplaintMlSnapshotHash({
    complaintId: snapshot.complaintId,
    featureVersion: snapshot.featureVersion,
    features: snapshot.features,
    missingness: snapshot.missingness,
    interpretation: snapshot.interpretation,
    provenance: snapshot.provenance,
  });

  console.log(`Complaint ID: ${snapshot.complaintId}`);
  console.log(`Feature version: ${snapshot.featureVersion}`);
  console.log(`Stored hash:     ${snapshot.integrityHash}`);
  console.log(`Calculated hash: ${calculatedHash}`);

  if (snapshot.integrityHash === calculatedHash) {
    console.log("\nRESULT: MATCH");
    console.log("Snapshot content matches its stored integrity hash.");
  } else {
    console.error("\nRESULT: MISMATCH");
    console.error("Snapshot content does not match its stored hash.");
    process.exitCode = 1;
  }

  console.log("\nREAD-ONLY VERIFICATION COMPLETE.");
  console.log("No database records were modified.");
}

main()
  .catch((error) => {
    console.error("Verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
