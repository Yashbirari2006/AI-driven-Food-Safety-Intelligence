import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  const id = 1;

  const result = await prisma.complaint.findUnique({
    where: { id },
    select: {
      id: true,
      createdAt: true,
      establishmentId: true,
      images: {
        select: {
          id: true,
          processingStatus: true,
          imageAnalyses: {
            select: {
              id: true,
              status: true,
              modelVersion: true
            }
          }
        }
      },
      triages: {
        select: {
          urgency: true,
          actionability: true,
          rulesVersion: true,
          assessedAt: true
        }
      }
    }
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error("Inspection failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
