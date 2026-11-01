import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  const [
    totalComplaints,
    linkedComplaints,
    complaintsWithImages,
    totalImages,
    totalTriages,
    totalImageAnalyses,
    establishments,
    verifiedRecords
  ] = await Promise.all([
    prisma.complaint.count(),
    prisma.complaint.count({
      where: { establishmentId: { not: null } }
    }),
    prisma.complaint.count({
      where: { images: { some: {} } }
    }),
    prisma.complaintImage.count(),
    prisma.complaintTriage.count(),
    prisma.imageAnalysis.count(),
    prisma.establishment.count(),
    prisma.establishmentRecord.count({
      where: { verified: true }
    })
  ]);

  console.log({
    totalComplaints,
    linkedComplaints,
    complaintsWithImages,
    totalImages,
    totalTriages,
    totalImageAnalyses,
    establishments,
    verifiedRecords
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
