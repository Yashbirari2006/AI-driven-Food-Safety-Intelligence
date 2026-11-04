import assert from "node:assert/strict";

import {
  createComplaintMlSnapshotHash,
  type ComplaintMlSnapshotHashInput,
} from "../src/services/complaintMlSnapshotIntegrityService";

const baseInput: ComplaintMlSnapshotHashInput = {
  complaintId: 13,
  featureVersion: "complaint-ml-features-v2",
  features: {
    title: "Food quality complaint",
    description: "Unusual smell reported",
    foodType: "Dairy",
    district: null,
    photoCount: 1,
  },
  missingness: {
    district: true,
    establishmentType: true,
  },
  interpretation: {
    reportStatus: "UNVERIFIED",
    predictionPermitted: false,
  },
  provenance: {
    snapshotPolicy: "SUBMISSION_TIME",
    imageCutoff: "UPLOADED_AT_LESS_THAN_OR_EQUAL_TO_COMPLAINT_CREATED_AT",
  },
};

let passed = 0;
let failed = 0;

function test(name: string, callback: () => void): void {
  try {
    callback();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL: ${name}`);

    if (error instanceof Error) {
      console.error(`      ${error.message}`);
    }
  }
}

function hash(input: ComplaintMlSnapshotHashInput): string {
  return createComplaintMlSnapshotHash(input);
}

test("Produces a 64-character SHA-256 hexadecimal digest", () => {
  const result = hash(baseInput);

  assert.match(result, /^[a-f0-9]{64}$/);
});

test("Produces the same hash for identical input", () => {
  assert.equal(hash(baseInput), hash(baseInput));
});

test("Object key ordering does not change the hash", () => {
  const reordered: ComplaintMlSnapshotHashInput = {
    provenance: {
      imageCutoff:
        "UPLOADED_AT_LESS_THAN_OR_EQUAL_TO_COMPLAINT_CREATED_AT",
      snapshotPolicy: "SUBMISSION_TIME",
    },
    interpretation: {
      predictionPermitted: false,
      reportStatus: "UNVERIFIED",
    },
    missingness: {
      establishmentType: true,
      district: true,
    },
    features: {
      photoCount: 1,
      district: null,
      foodType: "Dairy",
      description: "Unusual smell reported",
      title: "Food quality complaint",
    },
    featureVersion: "complaint-ml-features-v2",
    complaintId: 13,
  };

  assert.equal(hash(baseInput), hash(reordered));
});

test("Changing complaintId changes the hash", () => {
  const changed = { ...baseInput, complaintId: 14 };

  assert.notEqual(hash(baseInput), hash(changed));
});

test("Changing featureVersion changes the hash", () => {
  const changed = {
    ...baseInput,
    featureVersion: "complaint-ml-features-v3",
  };

  assert.notEqual(hash(baseInput), hash(changed));
});

test("Changing features changes the hash", () => {
  const changed = {
    ...baseInput,
    features: {
      ...baseInput.features as Record<string, unknown>,
      photoCount: 2,
    },
  };

  assert.notEqual(hash(baseInput), hash(changed));
});

test("Changing missingness changes the hash", () => {
  const changed = {
    ...baseInput,
    missingness: {
      district: false,
      establishmentType: true,
    },
  };

  assert.notEqual(hash(baseInput), hash(changed));
});

test("Changing interpretation changes the hash", () => {
  const changed = {
    ...baseInput,
    interpretation: {
      reportStatus: "UNVERIFIED",
      predictionPermitted: true,
    },
  };

  assert.notEqual(hash(baseInput), hash(changed));
});

test("Changing provenance changes the hash", () => {
  const changed = {
    ...baseInput,
    provenance: {
      snapshotPolicy: "DIFFERENT_POLICY",
      imageCutoff:
        "UPLOADED_AT_LESS_THAN_OR_EQUAL_TO_COMPLAINT_CREATED_AT",
    },
  };

  assert.notEqual(hash(baseInput), hash(changed));
});

test("Array order is preserved", () => {
  const first = {
    ...baseInput,
    features: { values: ["Low", "Medium", "High"] },
  };

  const second = {
    ...baseInput,
    features: { values: ["High", "Medium", "Low"] },
  };

  assert.notEqual(hash(first), hash(second));
});

test("Rejects an invalid complaint ID", () => {
  assert.throws(
    () => hash({ ...baseInput, complaintId: 0 }),
    /Invalid complaint ID/,
  );
});

test("Rejects an empty feature version", () => {
  assert.throws(
    () => hash({ ...baseInput, featureVersion: "   " }),
    /feature version cannot be empty/,
  );
});

test("Rejects non-finite numbers", () => {
  const invalid = {
    ...baseInput,
    features: { score: Number.NaN },
  };

  assert.throws(
    () => hash(invalid),
    /non-finite number/,
  );
});

test("Rejects undefined values", () => {
  const invalid = {
    ...baseInput,
    features: { title: undefined },
  };

  assert.throws(
    () => hash(invalid),
    /undefined value/,
  );
});

test("Rejects unsupported object types", () => {
  const invalid = {
    ...baseInput,
    features: { capturedAt: new Date() },
  };

  assert.throws(
    () => hash(invalid),
    /unsupported object type/,
  );
});

console.log("\nIntegrity hash test summary");
console.log("---------------------------");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);

if (failed > 0) {
  process.exitCode = 1;
}