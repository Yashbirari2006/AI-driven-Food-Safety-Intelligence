import prisma from "./lib/prisma";

async function main() {
  const users = await prisma.user.findMany();

  console.log("Database connected successfully!");
  console.log("Users:", users);
}

main()
  .catch((error) => {
    console.error("Database connection failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });