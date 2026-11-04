import test from "node:test";
import assert from "node:assert/strict";
import type { Response } from "express";
import { predictRisk } from "./aiController";

function createResponse() {
  return {
    statusCode: 200,
    payload: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };
}

test("unauthenticated requests are rejected", async () => {
  const req = {} as Parameters<typeof predictRisk>[0];
  const res = createResponse();

  await predictRisk(req, res as unknown as Response);

  assert.equal(res.statusCode, 401);
});

test("unsupported roles cannot request predictions", async () => {
  const req = {
    user: { userId: 10, role: "LAB_OFFICER" },
  } as Parameters<typeof predictRisk>[0];
  const res = createResponse();

  await predictRisk(req, res as unknown as Response);

  assert.equal(res.statusCode, 403);
});

test("officers cannot submit unverified inspection features for ML prediction", async () => {
  const req = {
    user: { userId: 10, role: "FOOD_SAFETY_OFFICER" },
    body: {
      complaintId: 14,
      features: { hygiene_score: 1, pest_signs: 1 },
    },
  } as Parameters<typeof predictRisk>[0];
  const res = createResponse();

  await predictRisk(req, res as unknown as Response);

  assert.equal(res.statusCode, 409);
  assert.equal(
    (res.payload as { code: string }).code,
    "VERIFIED_INSPECTION_INPUTS_REQUIRED",
  );
  assert.equal(
    (res.payload as { predictionGenerated: boolean }).predictionGenerated,
    false,
  );
  assert.equal(
    (res.payload as { assessmentCreated: boolean }).assessmentCreated,
    false,
  );
});

test("citizens cannot generate complaint-stage ML predictions", async () => {
  const req = {
    user: { userId: 20, role: "CITIZEN" },
    body: { complaintId: 14, features: {} },
  } as Parameters<typeof predictRisk>[0];
  const res = createResponse();

  await predictRisk(req, res as unknown as Response);

  assert.equal(res.statusCode, 409);
  assert.equal(
    (res.payload as { assessmentCreated: boolean }).assessmentCreated,
    false,
  );
});
