
import {
  buildComplaintMlFeatureVectorV2,
} from "../src/services/complaintMlFeatureServiceV2";

import type {
  ComplaintMlFeatureVectorV2,
} from "../src/services/complaintMlFeatureServiceV2";

const submissionTime = new Date("2026-10-01T10:00:00.000Z");

const mockComplaint = {
  id: 9001,
  title: "Test food quality complaint",
  description: "Test complaint for temporal boundary validation.",
  foodType: "Dairy Product",
  incidentDate: new Date("2026-10-01T08:00:00.000Z"),
  createdAt: submissionTime,
  images: [
    { id: 1, uploadedAt: new Date("2026-10-01T09:59:00.000Z") },
    { id: 2, uploadedAt: new Date("2026-10-01T10:00:00.000Z") },
    { id: 3, uploadedAt: new Date("2026-10-01T10:01:00.000Z") },
  ],
};

type ComplaintDb = NonNullable<
  Parameters<typeof buildComplaintMlFeatureVectorV2>[1]
>;

async function main() {
  console.log("Starting V2 temporal boundary tests...\n");

  let databaseCalls = 0;
  let receivedQuery: unknown;

  const mockDb = {
    complaint: {
      findUnique: async (args: unknown) => {
        databaseCalls++;
        receivedQuery = args;
        return mockComplaint;
      },
    },
  } as unknown as ComplaintDb;

  const result: ComplaintMlFeatureVectorV2 =
    await buildComplaintMlFeatureVectorV2(9001, mockDb);

  const tests: Array<[string, boolean]> = [
    [
      "Image uploaded before submission is included",
      result.features.photoCount === 2,
    ],
    [
      "Image uploaded exactly at submission is included",
      result.features.photoCount === 2 &&
        mockComplaint.images.some(
          image =>
            image.uploadedAt.getTime() === submissionTime.getTime()
        ),
    ],
    [
      "Image uploaded after submission is excluded",
      result.features.photoCount === 2 &&
        mockComplaint.images.filter(
          image => image.uploadedAt.getTime() > submissionTime.getTime()
        ).length === 1,
    ],
    [
      "Incident submission delay is calculated correctly",
      result.features.incidentSubmissionDelayDays === 0,
    ],
    [
      "Establishment district remains unknown",
      result.features.district === null,
    ],
    [
      "Establishment type remains unknown",
      result.features.establishmentType === null,
    ],
    [
      "Previous complaint counts remain unknown",
      result.features.previousComplaintCount === null &&
        result.features.previousComplaints30dCount === null,
    ],
    [
      "Prediction remains disabled",
      result.interpretation.predictionPermitted === false,
    ],
    [
      "Exactly one mocked database read occurred",
      databaseCalls === 1,
    ],
  ];

  const query = receivedQuery as {
    select?: Record<string, unknown>;
  };

  const selectedFields = Object.keys(query?.select ?? {});
  const imageSelection = query?.select?.images as
    | { select?: Record<string, unknown> }
    | undefined;

  const imageFields = Object.keys(imageSelection?.select ?? {});

  tests.push([
    "Query excludes retrospective establishment, triage and image analyses",
    !selectedFields.includes("establishment") &&
      !selectedFields.includes("triages") &&
      !selectedFields.includes("imageAnalyses"),
  ]);

  tests.push([
    "Query selects image upload timestamps for temporal filtering",
    imageFields.includes("uploadedAt"),
  ]);

  let passed = 0;
  let failed = 0;

  for (const [name, success] of tests) {
    if (success) {
      passed++;
      console.log(`PASS — ${name}`);
    } else {
      failed++;
      console.error(`FAIL — ${name}`);
    }
  }

  console.log("\n========== TEMPORAL TEST SUMMARY ==========");
  console.log(`Total tests: ${tests.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log("PostgreSQL writes: 0");
  console.log("===========================================\n");

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error("Temporal boundary test failed:", error);
  process.exitCode = 1;
});
