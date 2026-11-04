import { createHash } from "crypto";

export interface ComplaintMlSnapshotHashInput {
  complaintId: number;
  featureVersion: string;
  features: unknown;
  missingness: unknown;
  interpretation: unknown;
  provenance: unknown;
}

/**
 * Converts JSON-compatible values into a deterministic representation.
 * Object keys are sorted recursively; array order is preserved.
 */
function canonicalize(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Snapshot contains a non-finite number.");
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);

    if (
      prototype !== Object.prototype &&
      prototype !== null
    ) {
      throw new Error(
        "Snapshot contains an unsupported object type.",
      );
    }

    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};

    for (const key of Object.keys(record).sort()) {
      if (record[key] === undefined) {
        throw new Error(
          `Snapshot contains an undefined value at key: ${key}`,
        );
      }

      sorted[key] = canonicalize(record[key]);
    }

    return sorted;
  }

  throw new Error(
    `Unsupported snapshot value type: ${typeof value}`,
  );
}

/**
 * Creates a SHA-256 digest for immutable snapshot content.
 *
 * Hash coverage:
 * - complaintId
 * - featureVersion
 * - features
 * - missingness
 * - interpretation
 * - provenance
 *
 * The database-generated snapshot ID and capturedAt timestamp
 * are intentionally excluded. The timestamp must be protected
 * separately by the planned database immutability safeguard.
 */
export function createComplaintMlSnapshotHash(
  input: ComplaintMlSnapshotHashInput,
): string {
  if (
    !Number.isInteger(input.complaintId) ||
    input.complaintId <= 0
  ) {
    throw new Error("Invalid complaint ID for snapshot hashing.");
  }

  if (
    typeof input.featureVersion !== "string" ||
    !input.featureVersion.trim()
  ) {
    throw new Error("Snapshot feature version cannot be empty.");
  }

  const canonicalPayload = canonicalize({
    complaintId: input.complaintId,
    featureVersion: input.featureVersion,
    features: input.features,
    missingness: input.missingness,
    interpretation: input.interpretation,
    provenance: input.provenance,
  });

  return createHash("sha256")
    .update(JSON.stringify(canonicalPayload), "utf8")
    .digest("hex");
}