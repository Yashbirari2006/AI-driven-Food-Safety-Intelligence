
import "dotenv/config";

import prisma from "../src/lib/prisma";
import { extractComplaintFeatures } from "../src/services/complaintFeatureService";

async function main() {
  console.log("Starting complaint feature extraction test...");

  const complaint = await prisma.complaint.findFirst({
    orderBy: { id: "asc" },
    select: { id: true },
  });

  if (!complaint) {
    console.log("No complaint records found. Submit a test complaint first.");
    return;
  }

  console.log(`Testing complaint ID: ${complaint.id}`);

  const result = await extractComplaintFeatures(complaint.id);

  console.log("\n========== EXTRACTION RESULT ==========");
  console.log(JSON.stringify(result, null, 2));

  console.log("\n========== DATA QUALITY SUMMARY ==========");
  console.log("Complaint ID:", result.complaintId);
  console.log("Photo count:", result.evidence.photoCount);
  console.log(
    "Establishment linked:",
    result.dataQuality.hasEstablishmentLink
  );
  console.log(
    "Verified records available:",
    result.dataQuality.hasVerifiedEstablishmentRecords
  );
  console.log(
    "Image analysis available:",
    result.dataQuality.hasSuccessfulImageAnalysis
  );
  console.log("Missing fields:", result.dataQuality.missingFields);

  console.log("\nExtraction test completed.");
}

main()
  .catch((error) => {
    console.error("Extraction test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
