
require("dotenv").config();

const bcrypt = require("bcrypt");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  let prisma;

  try {
    const email = (await rl.question("Officer account email: "))
      .trim()
      .toLowerCase();

    const password = await rl.question("Enter NEW password (min 8 chars): ");

    if (!email || password.length < 8) {
      throw new Error("Email is required and password must be at least 8 characters.");
    }

    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is missing from backend .env.");
    }

    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });

    prisma = new PrismaClient({ adapter });

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new Error("No account found for that email. No changes made.");
    }

    if (user.role !== "FOOD_SAFETY_OFFICER") {
      throw new Error(`Account role is ${user.role}, not FOOD_SAFETY_OFFICER. No changes made.`);
    }

    const confirmed = await rl.question(
      `Reset password for ${user.email} (${user.role})? Type YES to confirm: `
    );

    if (confirmed.trim() !== "YES") {
      console.log("Cancelled. No changes made.");
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    console.log("Password reset successful. Officer role unchanged.");
  } finally {
    rl.close();
    if (prisma) await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Reset failed:", error.message);
  process.exitCode = 1;
});
