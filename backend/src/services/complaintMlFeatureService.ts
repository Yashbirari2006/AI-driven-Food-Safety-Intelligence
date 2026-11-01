
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { extractComplaintFeatures } from "./complaintFeatureService";

export const COMPLAINT_ML_FEATURE_VERSION = "complaint-ml-features-v1";

/**
 * Both root Prisma client and transaction client expose
 * the complaint delegate needed by the feature extractor.
 */
type ComplaintFeatureDb = Pick<Prisma.TransactionClient, "complaint">;

/**
 * Version 1 complaint-stage feature contract.
 *
 * Deliberately excluded:
 * - Complaint.status: workflow state, not a verified risk outcome.
 * - ComplaintTriage urgency/actionability: rule-engine outputs.
 * - Existing 13-feature inspection model inputs and predictions.
 * - Unverified licence assumptions.
 *
 * All features are derived from persisted complaint data.
 * Missing information is represented explicitly.
 */
export const COMPLAINT_ML_FEATURE_CONTRACT = [
  {
    name: "title",
    type: "text",
    source: "Complaint.title",
    missingAllowed: false,
  },
  {
    name: "description",
    type: "text",
    source: "Complaint.description",
    missingAllowed: false,
  },
  {
    name: "foodType",
    type: "categorical",
    source: "Complaint.foodType",
    missingAllowed: false,
  },
  {
    name: "district",
    type: "categorical",
    source: "Establishment.district",
    missingAllowed: true,
  },
  {
    name: "establishmentType",
    type: "categorical",
    source: "Establishment.establishmentType",
    missingAllowed: true,
  },
  {
    name: "photoCount",
    type: "numeric",
    source: "ComplaintImage records",
    missingAllowed: false,
  },
  {
    name: "incidentSubmissionDelayDays",
    type: "numeric",
    source: "Complaint.incidentDate and Complaint.createdAt",
    missingAllowed: true,
  },
  {
    name: "previousComplaintCount",
    type: "numeric",
    source: "Earlier complaints linked to the same establishment",
    missingAllowed: true,
  },
  {
    name: "previousComplaints30dCount",
    type: "numeric",
    source: "Earlier linked complaints within 30 days",
    missingAllowed: true,
  },
  {
    name: "verifiedRecordCount",
    type: "numeric",
    source: "Verified EstablishmentRecord records",
    missingAllowed: true,
  },
  {
    name: "successfulImageAnalysisCount",
    type: "numeric",
    source: "Completed image analyses with non-null findings",
    missingAllowed: false,
  },
] as const;

export type ComplaintMlFeatureVector = {
  featureVersion: typeof COMPLAINT_ML_FEATURE_VERSION;

  features: {
    title: string;
    description: string;
    foodType: string;

    district: string | null;
    establishmentType: string | null;

    photoCount: number;
    incidentSubmissionDelayDays: number | null;

    previousComplaintCount: number | null;
    previousComplaints30dCount: number | null;
    verifiedRecordCount: number | null;

    successfulImageAnalysisCount: number;
  };

  missingness: {
    establishmentLinkMissing: boolean;
    districtMissing: boolean;
    establishmentTypeMissing: boolean;
    establishmentHistoryMissing: boolean;
    incidentSubmissionDelayMissing: boolean;
    imageAnalysisFindingsMissing: boolean;
  };

  interpretation: {
    complaintReportsAreUnverified: true;
    imageFindingsAreNotIndependentlyVerified: true;
    verifiedRecordsAreSourceFiltered: true;
    predictionPermitted: false;
    reason: string;
  };

  provenance: {
    extractorVersion: string;
    featureContractVersion: typeof COMPLAINT_ML_FEATURE_VERSION;
  };
};

/**
 * Creates an allowlisted complaint-stage ML input snapshot.
 *
 * The optional db parameter supports:
 * - Normal Prisma client execution.
 * - Execution inside an existing Prisma transaction.
 *
 * This function does not:
 * - Train or call a model.
 * - Generate a risk score.
 * - Generate a complaint outcome label.
 * - Replace missing values with arbitrary defaults.
 */
export async function buildComplaintMlFeatureVector(
  complaintId: number,
  db: ComplaintFeatureDb = prisma
): Promise<ComplaintMlFeatureVector> {
  const snapshot = await extractComplaintFeatures(complaintId, db);

  const establishment = snapshot.establishment;

  const district =
    establishment &&
    typeof establishment.district === "string" &&
    establishment.district.trim().length > 0
      ? establishment.district.trim()
      : null;

  const establishmentType =
    establishment &&
    typeof establishment.establishmentType === "string" &&
    establishment.establishmentType.trim().length > 0
      ? establishment.establishmentType.trim()
      : null;

  const incidentDelay =
    snapshot.complaint.daysBetweenIncidentAndSubmission;

  const hasEstablishmentLink = establishment !== null;

  return {
    featureVersion: COMPLAINT_ML_FEATURE_VERSION,

    features: {
      title: snapshot.complaint.title,
      description: snapshot.complaint.description,
      foodType: snapshot.complaint.foodType,

      district,
      establishmentType,

      photoCount: snapshot.evidence.photoCount,

      incidentSubmissionDelayDays: incidentDelay,

      previousComplaintCount: hasEstablishmentLink
        ? establishment.previousComplaintCount
        : null,

      previousComplaints30dCount: hasEstablishmentLink
        ? establishment.previousComplaints30dCount
        : null,

      verifiedRecordCount: hasEstablishmentLink
        ? establishment.verifiedRecordCount
        : null,

      successfulImageAnalysisCount:
        snapshot.evidence.availableImageAnalyses.length,
    },

    missingness: {
      establishmentLinkMissing: !hasEstablishmentLink,
      districtMissing: district === null,
      establishmentTypeMissing: establishmentType === null,

      establishmentHistoryMissing: !hasEstablishmentLink,

      incidentSubmissionDelayMissing: incidentDelay === null,

      imageAnalysisFindingsMissing:
        !snapshot.dataQuality.hasSuccessfulImageAnalysis,
    },

    interpretation: {
      complaintReportsAreUnverified: true,
      imageFindingsAreNotIndependentlyVerified: true,
      verifiedRecordsAreSourceFiltered: true,
      predictionPermitted: false,

      reason:
        "This is a feature snapshot only. Independent, verified complaint outcome labels and a validated training dataset are not yet available.",
    },

    provenance: {
      extractorVersion: snapshot.schemaVersion,
      featureContractVersion: COMPLAINT_ML_FEATURE_VERSION,
    },
  };
}
