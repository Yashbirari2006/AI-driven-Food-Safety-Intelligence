
import "dotenv/config";
import bcrypt from "bcrypt";
import prisma from "./src/lib/prisma";

async function main() {
  const email = "officer.test@foodsafety.local";
  const password = process.env.TEST_OFFICER_PASSWORD;

  if (!password || password.length < 12) {
    throw new Error(
      "Set TEST_OFFICER_PASSWORD to a password of at least 12 characters."
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    if (existingUser.role !== "FOOD_SAFETY_OFFICER") {
      throw new Error(
        "The test email already belongs to a non-officer account. No changes made."
      );
    }

    console.log("Officer test account already exists.");
    console.log("User ID:", existingUser.id);
    console.log("Role:", existingUser.role);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const officer = await prisma.user.create({
    data: {
      name: "Local Food Safety Test Officer",
      email,
      password: hashedPassword,
      role: "FOOD_SAFETY_OFFICER",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  console.log("Local officer test account created:");
  console.log(officer);
}

main()
  .catch((error) => {
    console.error("Officer setup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
