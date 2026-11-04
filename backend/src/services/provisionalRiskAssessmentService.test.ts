
import test from "node:test";
import assert from "node:assert/strict";

import { evaluateComplaintTriage } from "./triageService";
import {
  evaluateProvisionalRiskAssessment,
  PROVISIONAL_RISK_RULES_VERSION,
} from "./provisionalRiskAssessmentService";

function assess(description: string, photoCount = 0) {
  const input = {
    title: "Food safety complaint",
    description,
    foodType: "Prepared food",
    photoCount,
  };

  const triage = evaluateComplaintTriage(input);

  return evaluateProvisionalRiskAssessment({
    ...input,
    triage,
  });
}

test("no detected signals produces a zero-score LOW screening result", () => {
  const result = assess(
    "I want the officer to inspect this food establishment.",
  );

  assert.equal(result.riskScore, 0);
  assert.equal(result.riskLevel, "LOW");
  assert.equal(result.contributingFactors.signals.length, 0);
});

test("reported illness contributes to the screening score", () => {
  const result = assess(
    "I experienced vomiting after eating the food.",
  );

  assert.equal(result.riskScore, 25);
  assert.equal(result.riskLevel, "MEDIUM");
  assert.ok(
    result.contributingFactors.signals.some(
      (signal) => signal.code === "REPORTED_ILLNESS",
    ),
  );
});

test("multiple reported signals can produce HIGH screening level", () => {
  const result = assess(
    "Several customers experienced food poisoning. " +
      "The shop is still serving food.",
  );

  assert.equal(result.riskScore, 50);
  assert.equal(result.riskLevel, "HIGH");
});

test("submitted photographs do not automatically increase risk score", () => {
  const withoutPhoto = assess(
    "Rotten food was found at the establishment.",
    0,
  );

  const withPhoto = assess(
    "Rotten food was found at the establishment.",
    2,
  );

  assert.equal(withPhoto.riskScore, withoutPhoto.riskScore);
  assert.equal(withPhoto.evidenceSnapshot.photoCount, 2);
  assert.equal(withPhoto.evidenceQuality, "INSUFFICIENT");
});

test("assessment always remains provisional and requires human review", () => {
  const result = assess(
    "Cockroaches were seen in the kitchen.",
  );

  assert.equal(result.status, "PROVISIONAL");
  assert.equal(result.humanReviewRequired, true);
  assert.equal(result.evidenceSnapshot.allegationsVerified, false);
});

test("assessment records its rule version and engine", () => {
  const result = assess("Expired food was reported.");

  assert.equal(
    result.modelVersions.rulesVersion,
    PROVISIONAL_RISK_RULES_VERSION,
  );
  assert.equal(result.modelVersions.engine, "RULE_BASED");
});

test("invalid negative photo count is rejected", () => {
  const input = {
    title: "Complaint",
    description: "Expired food was reported.",
    foodType: "Food",
    photoCount: -1,
  };

  const triage = evaluateComplaintTriage(input);

  assert.throws(
    () =>
      evaluateProvisionalRiskAssessment({
        ...input,
        triage,
      }),
    /photoCount must be a non-negative integer/,
  );
});

// Risk classification boundary tests

test("15 points remains LOW", () => {
  const result = assess("Several customers reported a concern.");

  assert.equal(result.riskScore, 15);
  assert.equal(result.riskLevel, "LOW");
});

test("20 points becomes MEDIUM", () => {
  const result = assess("A foreign object was found in the food.");

  assert.equal(result.riskScore, 20);
  assert.equal(result.riskLevel, "MEDIUM");
});

test("45 points remains MEDIUM", () => {
  const result = assess(
    "I experienced vomiting. A foreign object was found in the food.",
  );

  assert.equal(result.riskScore, 45);
  assert.equal(result.riskLevel, "MEDIUM");
});

test("50 points becomes HIGH", () => {
  const result = assess(
    "I experienced vomiting. Several customers were affected. " +
      "The shop is still serving food.",
  );

  assert.equal(result.riskScore, 50);
  assert.equal(result.riskLevel, "HIGH");
});

// Individual signal weight tests

test("all eight reported signals contribute their configured weights", () => {
  const cases = [
    ["vomiting", 25],
    ["several customers", 15],
    ["still serving", 10],
    ["foreign object", 20],
    ["rotten food", 10],
    ["cockroaches", 10],
    ["dirty kitchen", 5],
    ["improper storage", 5],
  ] as const;

  for (const [description, expectedScore] of cases) {
    const result = assess(description);

    assert.equal(result.riskScore, expectedScore, description);
  }
});

// Input validation tests

test("fractional and non-finite photo counts are rejected", () => {
  const input = {
    title: "Complaint",
    description: "Expired food was reported.",
    foodType: "Food",
  };

  const triage = evaluateComplaintTriage({
    ...input,
    photoCount: 0,
  });

  for (const photoCount of [1.5, NaN, Infinity, -Infinity]) {
    assert.throws(
      () =>
        evaluateProvisionalRiskAssessment({
          ...input,
          photoCount,
          triage,
        }),
      /photoCount must be a non-negative integer/,
    );
  }
});
