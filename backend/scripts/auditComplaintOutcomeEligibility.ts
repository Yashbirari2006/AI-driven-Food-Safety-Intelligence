import prisma from "../src/lib/prisma";

const EXPECTED_FEATURE_VERSION = "complaint-ml-features-v1";

const REQUIRED_FEATURE_KEYS = [
  "title",
  "description",
  "foodType",
  "district",
  "establishmentType",
  "photoCount",
  "incidentSubmissionDelayDays",
  "previousComplaintCount",
  "previousComplaints30dCount",
  "verifiedRecordCount",
  "successfulImageAnalysisCount",
] as const;

const AUTHORIZED_ROLES = [
  "FOOD_SAFETY_OFFICER",
  "SUPERVISOR",
];

type AuditResult = {
  assessmentId: number;
  complaintId: number;
  outcome: string;
  eligible: boolean;
  reasons: string[];
  verifiedEvidenceCount: number;
  acceptedEvidenceCount: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function hasRequiredFeatureContract(features: unknown): boolean {
  if (!isObject(features)) {
    return false;
  }

  return REQUIRED_FEATURE_KEYS.every((key) =>
    Object.prototype.hasOwnProperty.call(features, key)
  );
}

function hasValidSnapshotMetadata(snapshot: {
  featureVersion: string;
  features: unknown;
  missingness: unknown;
  interpretation: unknown;
  provenance: unknown;
}): boolean {
  return (
    snapshot.featureVersion === EXPECTED_FEATURE_VERSION &&
    hasRequiredFeatureContract(snapshot.features) &&
    isObject(snapshot.missingness) &&
    isObject(snapshot.interpretation) &&
    isObject(snapshot.provenance)
  );
}

async function main() {
  console.log("\nCOMPLAINT OUTCOME DATASET ELIGIBILITY AUDIT");
  console.log("Mode: READ ONLY");
  console.log("No records will be modified or deleted.\n");

  const assessments =
    await prisma.complaintOutcomeAssessment.findMany({
      orderBy: [{ complaintId: "asc" }, { id: "asc" }],
      include: {
        complaint: {
          select: {
            id: true,
            title: true,
            establishmentId: true,
            mlFeatureSnapshot: true,
          },
        },
        finalizedBy: {
          select: {
            id: true,
            role: true,
          },
        },
        supersededBy: {
          select: {
            id: true,
          },
        },
        evidence: {
          include: {
            verifiedBy: {
              select: {
                id: true,
                role: true,
              },
            },
          },
        },
      },
    });

  const results: AuditResult[] = [];

  for (const assessment of assessments) {
    const reasons: string[] = [];

    let acceptedEvidenceCount = 0;

    // 1. Outcome eligibility
    if (
      assessment.outcome !== "SUBSTANTIATED" &&
      assessment.outcome !== "NOT_SUBSTANTIATED"
    ) {
      reasons.push("OUTCOME_NOT_BINARY");
    }

    // 2. Finalization eligibility
    if (!assessment.isFinal) {
      reasons.push("ASSESSMENT_NOT_FINAL");
    }

    if (!assessment.finalizedAt) {
      reasons.push("FINALIZED_AT_MISSING");
    }

    if (!assessment.finalizedById || !assessment.finalizedBy) {
      reasons.push("FINALIZER_MISSING");
    } else if (
      !AUTHORIZED_ROLES.includes(assessment.finalizedBy.role)
    ) {
      reasons.push("FINALIZER_ROLE_NOT_AUTHORIZED");
    }

    // 3. Revision eligibility
    if (assessment.supersededBy) {
      reasons.push("ASSESSMENT_SUPERSEDED");
    }

    // 4. Feature snapshot eligibility
    const snapshot = assessment.complaint.mlFeatureSnapshot;

    if (!snapshot) {
      reasons.push("ML_FEATURE_SNAPSHOT_MISSING");
    } else if (!hasValidSnapshotMetadata(snapshot)) {
      reasons.push("ML_FEATURE_SNAPSHOT_INVALID");
    }

    // 5. Independently verify each evidence source
    const verifiedEvidence = assessment.evidence.filter(
      (item) => item.verificationStatus === "VERIFIED"
    );

    for (const evidence of verifiedEvidence) {
      let evidenceAccepted = true;

      if (!evidence.verifiedById || !evidence.verifiedBy) {
        evidenceAccepted = false;
      } else if (
        !AUTHORIZED_ROLES.includes(evidence.verifiedBy.role)
      ) {
        evidenceAccepted = false;
      }

      if (!evidence.verifiedAt) {
        evidenceAccepted = false;
      }

      if (!evidenceAccepted) {
        continue;
      }

      // Only this evidence source is currently implemented
      // with an independently verifiable source record.
      if (
        evidence.sourceType !==
        "VERIFIED_ESTABLISHMENT_RECORD"
      ) {
        continue;
      }

      if (!assessment.complaint.establishmentId) {
        continue;
      }

      if (!/^[1-9]\d*$/.test(evidence.sourceReference)) {
        continue;
      }

      const recordId = Number(evidence.sourceReference);

      if (!Number.isSafeInteger(recordId)) {
        continue;
      }

      const record = await prisma.establishmentRecord.findFirst({
        where: {
          id: recordId,
          establishmentId: assessment.complaint.establishmentId,
          verified: true,
        },
        select: {
          id: true,
          recordType: true,
          sourceType: true,
          verified: true,
        },
      });

      if (!record || !record.verified) {
        continue;
      }

      // Test records must never enter the training dataset.
      if (
        record.recordType.trim().toUpperCase() === "TEST_ONLY" ||
        record.sourceType.trim().toUpperCase() === "TEST_ONLY"
      ) {
        continue;
      }

      acceptedEvidenceCount++;
    }

    // Verified evidence rows that did not pass independent
    // source verification are not counted.
    if (acceptedEvidenceCount === 0) {
      reasons.push("NO_INDEPENDENTLY_ELIGIBLE_EVIDENCE");
    }

    const eligible = reasons.length === 0;

    results.push({
      assessmentId: assessment.id,
      complaintId: assessment.complaintId,
      outcome: assessment.outcome,
      eligible,
      reasons,
      verifiedEvidenceCount: verifiedEvidence.length,
      acceptedEvidenceCount,
    });

    console.log("----------------------------------------");
    console.log(`Assessment ID: ${assessment.id}`);
    console.log(`Complaint ID: ${assessment.complaintId}`);
    console.log(`Complaint: ${assessment.complaint.title}`);
    console.log(`Outcome: ${assessment.outcome}`);
    console.log(`Eligible: ${eligible ? "YES" : "NO"}`);
    console.log(
      `Verified evidence rows: ${verifiedEvidence.length}`
    );
    console.log(
      `Independently accepted evidence: ${acceptedEvidenceCount}`
    );

    if (reasons.length > 0) {
      console.log("Exclusion reasons:");
      reasons.forEach((reason) => console.log(`  - ${reason}`));
    } else {
      console.log("Exclusion reasons: None");
    }
  }

  const eligibleCount = results.filter(
    (item) => item.eligible
  ).length;

  const excludedCount = results.length - eligibleCount;

  console.log("\n========== FINAL SUMMARY ==========");
  console.log(`Total assessments: ${results.length}`);
  console.log(`Eligible assessments: ${eligibleCount}`);
  console.log(`Excluded assessments: ${excludedCount}`);

  console.log("\nASSESSMENT RESULTS");
  console.log(JSON.stringify(results, null, 2));

  console.log("\nDATA GOVERNANCE NOTES");
  console.log("- This audit is read-only.");
  console.log("- No database records were modified.");
  console.log("- TEST_ONLY source records are excluded.");
  console.log("- Unsupported evidence sources are not accepted.");
  console.log("- Eligibility does not mean a model has been trained.");
  console.log("- No dataset export or model training was performed.");

  if (eligibleCount === 0) {
    console.log(
      "\nSTATUS: No eligible training labels are currently available."
    );
  } else {
    console.log(
      "\nSTATUS: Eligible labels exist; further dataset review is still required before export or training."
    );
  }
}

main()
  .catch((error) => {
    console.error("Eligibility audit failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });