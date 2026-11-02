
import prisma from "../lib/prisma";
import { Prisma } from "@prisma/client";

const FEATURE_SCHEMA_VERSION = "complaint-features-v1";

type MissingField =
  | "establishment_link"
  | "establishment_district"
  | "establishment_type"
  | "verified_establishment_records"
  | "image_analysis_findings";

type IncidentDateStatus =
  | "VALID"
  | "INCIDENT_DATE_AFTER_SUBMISSION";

/**
 * Both the root Prisma client and Prisma transaction client
 * provide the complaint delegate required by this service.
 */
type ComplaintFeatureDb = Pick<Prisma.TransactionClient, "complaint">;

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Returns the whole number of days between two dates.
 * Returns null when the earlier date is actually later.
 */
function daysBetween(earlier: Date, later: Date): number | null {
  const difference = later.getTime() - earlier.getTime();

  if (difference < 0) {
    return null;
  }

  return Math.floor(difference / MILLISECONDS_PER_DAY);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Builds a read-only, provenance-aware feature snapshot for a complaint.
 *
 * The optional db parameter allows this function to run:
 * - With the normal Prisma client.
 * - Inside an existing Prisma transaction.
 *
 * Important:
 * - Complaint reports are allegations, not verified violations.
 * - Missing information remains null or is explicitly listed as missing.
 * - ComplaintTriage is returned separately and is not an ML label.
 * - TEST_ONLY establishment records are excluded.
 * - No inspection measurements or inspection-model inputs are fabricated.
 * - Image findings are available only when a completed analysis has findings.
 */
export async function extractComplaintFeatures(
  complaintId: number,
  db: ComplaintFeatureDb = prisma
) {
  if (!Number.isSafeInteger(complaintId) || complaintId <= 0) {
    throw new Error("A valid complaint ID is required.");
  }

  const complaint = await db.complaint.findUnique({
    where: { id: complaintId },
    include: {
      images: {
        select: {
          id: true,
          mimeType: true,
          sizeBytes: true,
          processingStatus: true,
          uploadedAt: true,
          imageAnalyses: {
            select: {
              id: true,
              modelVersion: true,
              status: true,
              findings: true,
              uncertaintyNote: true,
              analyzedAt: true,
            },
            orderBy: { analyzedAt: "desc" },
          },
        },
      },

      establishment: {
        include: {
          complaints: {
            where: {
              id: { not: complaintId },
            },
            select: {
              id: true,
              createdAt: true,
              incidentDate: true,
              status: true,
              foodType: true,
            },
            orderBy: { createdAt: "desc" },
          },

          records: {
            where: {
              verified: true,
              sourceType: {
                not: "TEST_ONLY",
              },
            },
            select: {
              id: true,
              recordType: true,
              sourceType: true,
              sourceReference: true,
              occurredAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },

      triages: {
        select: {
          urgency: true,
          actionability: true,
          rulesVersion: true,
          assessedAt: true,
        },
        orderBy: { assessedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!complaint) {
    throw new Error("Complaint not found.");
  }

  const extractedAt = new Date();
  const establishment = complaint.establishment;

  const incidentSubmissionDays = daysBetween(
    complaint.incidentDate,
    complaint.createdAt
  );

  const incidentDateStatus: IncidentDateStatus =
    incidentSubmissionDays === null
      ? "INCIDENT_DATE_AFTER_SUBMISSION"
      : "VALID";

  const previousComplaints = establishment
    ? establishment.complaints.filter(
        (item) => item.createdAt < complaint.createdAt
      )
    : [];

  const previousComplaints30d = previousComplaints.filter((item) => {
    const age = daysBetween(item.createdAt, complaint.createdAt);

    return age !== null && age <= 30;
  });

  const verifiedRecords = establishment?.records ?? [];

  const imageAnalyses = complaint.images.flatMap((image) =>
    image.imageAnalyses.map((analysis) => ({
      imageId: image.id,
      analysisId: analysis.id,
      modelVersion: analysis.modelVersion,
      status: analysis.status,
      findings: analysis.findings,
      uncertaintyNote: analysis.uncertaintyNote,
      analyzedAt: analysis.analyzedAt,
    }))
  );

  // A completed analysis without findings is not usable image evidence.
  const successfulImageAnalyses = imageAnalyses.filter(
    (analysis) =>
      analysis.status === "COMPLETED" &&
      analysis.findings !== null
  );

  const missingFields: MissingField[] = [];

  if (!establishment) {
    missingFields.push("establishment_link");
  } else {
    if (!isNonEmptyString(establishment.district)) {
      missingFields.push("establishment_district");
    }

    if (!isNonEmptyString(establishment.establishmentType)) {
      missingFields.push("establishment_type");
    }

    if (verifiedRecords.length === 0) {
      missingFields.push("verified_establishment_records");
    }
  }

  if (successfulImageAnalyses.length === 0) {
    missingFields.push("image_analysis_findings");
  }

  const latestTriage = complaint.triages[0] ?? null;

  return {
    schemaVersion: FEATURE_SCHEMA_VERSION,
    complaintId: complaint.id,
    extractedAt,

    complaint: {
      title: complaint.title,
      description: complaint.description,
      foodType: complaint.foodType,
      location: complaint.location,
      incidentDate: complaint.incidentDate,
      submittedAt: complaint.createdAt,
      status: complaint.status,

      daysBetweenIncidentAndSubmission: incidentSubmissionDays,
      incidentDateStatus,
    },

    evidence: {
      photoCount: complaint.images.length,

      photos: complaint.images.map((image) => ({
        imageId: image.id,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        processingStatus: image.processingStatus,
        uploadedAt: image.uploadedAt,
      })),

      availableImageAnalyses: successfulImageAnalyses,

      imageAnalysisNote:
        "Image findings are included only when a persisted image analysis has COMPLETED status and non-null findings. They are not independently verified by this extractor.",
    },

    establishment: establishment
      ? {
          id: establishment.id,
          name: establishment.name,
          establishmentType: establishment.establishmentType,
          district: establishment.district,
          licenceNumberPresent: Boolean(establishment.licenseNumber),
          licenceVerificationStatus: "NOT_ESTABLISHED",

          previousComplaintCount: previousComplaints.length,
          previousComplaints30dCount: previousComplaints30d.length,

          previousComplaints: previousComplaints.map((item) => ({
            id: item.id,
            createdAt: item.createdAt,
            incidentDate: item.incidentDate,
            status: item.status,
            foodType: item.foodType,
            interpretation: "REPORTED_COMPLAINT_NOT_VERIFIED_VIOLATION",
          })),

          verifiedRecordCount: verifiedRecords.length,
          verifiedRecords,
        }
      : null,

    ruleBasedTriage: latestTriage
      ? {
          urgency: latestTriage.urgency,
          actionability: latestTriage.actionability,
          rulesVersion: latestTriage.rulesVersion,
          assessedAt: latestTriage.assessedAt,
          interpretation: "RULE_BASED_SCREENING_NOT_ML_PREDICTION",
        }
      : null,

    dataQuality: {
      missingFields,

      hasEstablishmentLink: Boolean(establishment),

      hasVerifiedEstablishmentRecords: verifiedRecords.length > 0,

      hasSuccessfulImageAnalysis:
        successfulImageAnalyses.length > 0,

      incidentDateStatus,

      inspectionMeasurements: null,
      inspectionMeasurementsStatus: "NOT_AVAILABLE",

      licenceValidity: null,
      licenceValidityStatus: "NOT_ESTABLISHED",

      overallInterpretation:
        "This is an automatically extracted data snapshot. Missing values are not replaced with fabricated defaults. Complaint reports are not verified violations. Incident dates after submission dates are flagged as invalid.",
    },

    provenance: {
      complaint: "DATABASE_COMPLAINT_RECORD",
      photos: "DATABASE_COMPLAINT_IMAGE_METADATA",

      establishment: establishment
        ? "EXPLICIT_DATABASE_ESTABLISHMENT_LINK"
        : "NOT_LINKED",

      previousComplaints: establishment
        ? "LINKED_ESTABLISHMENT_COMPLAINT_RECORDS"
        : "NOT_AVAILABLE",

      verifiedRecords:
        "VERIFIED_ESTABLISHMENT_RECORDS_EXCLUDING_TEST_ONLY",

      imageAnalysis:
        "PERSISTED_COMPLETED_IMAGE_ANALYSES_WITH_NON_NULL_FINDINGS",

      triage: "PERSISTED_RULE_BASED_COMPLAINT_TRIAGE",

      extractorVersion: FEATURE_SCHEMA_VERSION,
    },
  };
}
