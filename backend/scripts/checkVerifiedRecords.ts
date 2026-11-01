import prisma from "../src/lib/prisma";

async function main() {
  const records = await prisma.establishmentRecord.findMany({
    select: {
      id: true,
      establishmentId: true,
      recordType: true,
      sourceType: true,
      description: true,
      verified: true,
      createdAt: true,
    },
    orderBy: { id: "asc" },
  });

  console.log("\nAll Establishment Records:");
  console.log(JSON.stringify(records, null, 2));
  console.log(`\nTotal records: ${records.length}`);
}

main()
  .catch((error) => {
    console.error("Database query failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
