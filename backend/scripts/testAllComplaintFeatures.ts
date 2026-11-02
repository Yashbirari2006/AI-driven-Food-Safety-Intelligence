import "dotenv/config";
import prisma from "../src/lib/prisma";
import { extractComplaintFeatures } from "../src/services/complaintFeatureService";

async function main() {
  const complaints = await prisma.complaint.findMany({
    select: { id: true },
    orderBy: { id: "asc" }
  });

  let successful = 0;
  let failed = 0;

  for (const complaint of complaints) {
    try {
      const result = await extractComplaintFeatures(complaint.id);

      successful++;

      console.log({
        complaintId: result.complaintId,
        establishmentLinked: result.dataQuality.hasEstablishmentLink,
        photoCount: result.evidence.photoCount,
        triageAvailable: result.ruleBasedTriage !== null,
        missingFields: result.dataQuality.missingFields
      });
    } catch (error) {
      failed++;
      console.error(`Complaint ${complaint.id} failed:`, error);
    }
  }

  console.log("\n========== TEST SUMMARY ==========");
  console.log({
    total: complaints.length,
    successful,
    failed
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
