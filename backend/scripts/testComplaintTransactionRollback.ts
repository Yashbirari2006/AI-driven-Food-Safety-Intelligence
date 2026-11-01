
import prisma from "../src/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

const TEST_MARKER = `ROLLBACK-TEST-${randomUUID()}`;
const FORCED_FAILURE = "INTENTIONAL_ROLLBACK_TEST";

async function main() {
  console.log("Starting complaint transaction rollback test...");

  const citizen = await prisma.user.findFirst({
    where: { role: "CITIZEN" },
    select: { id: true },
  });

  if (!citizen) {
    throw new Error("No CITIZEN user found. Test cannot run.");
  }

  const before = {
    complaints: await prisma.complaint.count({
      where: { title: TEST_MARKER },
    }),
    triages: await prisma.complaintTriage.count({
      where: { complaint: { title: TEST_MARKER } },
    }),
    images: await prisma.complaintImage.count({
      where: { complaint: { title: TEST_MARKER } },
    }),
    snapshots: await prisma.complaintMlFeatureSnapshot.count({
      where: { complaint: { title: TEST_MARKER } },
    }),
    audits: await prisma.auditLog.count({
      where: {
        action: "ROLLBACK_TEST",
        details: {
          path: ["testMarker"],
          equals: TEST_MARKER,
        },
      },
    }),
  };

  let intentionalFailureCaught = false;

  try {
    await prisma.$transaction(async (tx) => {
      const complaint = await tx.complaint.create({
        data: {
          citizenId: citizen.id,
          title: TEST_MARKER,
          description: "Temporary transaction rollback verification.",
          foodType: "Test",
          establishmentName: "Rollback Test Establishment",
          location: "Test Location",
          incidentDate: new Date(),
        },
      });

      await tx.complaintTriage.create({
        data: {
          complaintId: complaint.id,
          urgency: "NORMAL",
          actionability: "REVIEW_REQUIRED",
          reasons: ["Rollback test"],
          inputSnapshot: { test: true },
          rulesVersion: "rollback-test-v1",
        },
      });

      await tx.complaintImage.create({
        data: {
          complaintId: complaint.id,
          storageKey: `${TEST_MARKER}.jpg`,
          originalFilename: "rollback-test.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 100,
        },
      });

      await tx.complaintMlFeatureSnapshot.create({
        data: {
          complaintId: complaint.id,
          featureVersion: "rollback-test-v1",
          features: { test: true },
          missingness: {},
          interpretation: {
            predictionPermitted: false,
            testOnly: true,
          },
          provenance: {
            testMarker: TEST_MARKER,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: citizen.id,
          complaintId: complaint.id,
          action: "ROLLBACK_TEST",
          entityType: "COMPLAINT",
          entityId: String(complaint.id),
          details: { testMarker: TEST_MARKER },
        },
      });

      throw new Error(FORCED_FAILURE);
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === FORCED_FAILURE
    ) {
      intentionalFailureCaught = true;
      console.log("Intentional transaction failure caught.");
    } else {
      throw error;
    }
  }

  const after = {
    complaints: await prisma.complaint.count({
      where: { title: TEST_MARKER },
    }),
    triages: await prisma.complaintTriage.count({
      where: { complaint: { title: TEST_MARKER } },
    }),
    images: await prisma.complaintImage.count({
      where: { complaint: { title: TEST_MARKER } },
    }),
    snapshots: await prisma.complaintMlFeatureSnapshot.count({
      where: { complaint: { title: TEST_MARKER } },
    }),
    audits: await prisma.auditLog.count({
      where: {
        action: "ROLLBACK_TEST",
        details: {
          path: ["testMarker"],
          equals: TEST_MARKER,
        },
      },
    }),
  };

  const unchanged = (
    Object.keys(before) as Array<keyof typeof before>
  ).every((key) => before[key] === after[key]);

  console.log("\nBefore:", before);
  console.log("After:", after);

  if (!intentionalFailureCaught || !unchanged) {
    throw new Error("ROLLBACK TEST FAILED.");
  }

  console.log("\nPASS: All five database record types rolled back.");
}

main()
  .catch((error) => {
    console.error("\nROLLBACK TEST FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
