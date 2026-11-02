import prisma from "../lib/prisma";
import { Prisma } from "@prisma/client";

export const COMPLAINT_ML_FEATURE_VERSION_V2 =
  "complaint-ml-features-v2";

/**
 * The root Prisma client and transaction client both expose
 * the complaint delegate used by this read-only service.
 */
type ComplaintFeatureDb = Pick<Prisma.TransactionClient, "complaint">;

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(
  earlier: Date,
  later: Date
): number | null {
  const difference = later.getTime() - earlier.getTime();

  if (difference < 0) {
    return null;
  }

  return Math.floor(difference / MILLISECONDS_PER_DAY);
}

export const COMPLAINT_ML_FEATURE_CONTRACT_V2 = [
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
    source: "Not available at submission in the current workflow",
    missingAllowed: true,
  },
  {
    name: "establishmentType",
    type: "categorical",
    source: "Not available at submission in the current workflow",
    missingAllowed: true,
  },
  {
    name: "photoCount",
    type: "numeric",
    source: "ComplaintImage.uploadedAt <= Complaint.createdAt",
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
    source: "Not available without a submission-time establishment link",
    missingAllowed: true,
  },
  {
    name: "previousComplaints30dCount",
    type: "numeric",
    source: "Not available without a submission-time establishment link",
    missingAllowed: true,
  },
] as const;

export type ComplaintMlFeatureVectorV2 = {
  featureVersion: typeof COMPLAINT_ML_FEATURE_VERSION_V2;

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
  };

  missingness: {
    establishmentLinkMissingAtSubmission: true;
    districtMissing: true;
    establishmentTypeMissing: true;
    establishmentHistoryMissing: true;
    incidentSubmissionDelayMissing: boolean;
  };

  interpretation: {
    complaintReportsAreUnverified: true;
    establishmentIdentityResolvedAtSubmission: false;
    predictionPermitted: false;
    reason: string;
  };

  provenance: {
    extractorVersion: "complaint-feature-extractor-v2";
    featureContractVersion: typeof COMPLAINT_ML_FEATURE_VERSION_V2;
    snapshotPolicy: "SUBMISSION_TIME";
    imageCutoff: "UPLOADED_AT_LESS_THAN_OR_EQUAL_TO_COMPLAINT_CREATED_AT";
    establishmentContextPolicy: "NO_POST_SUBMISSION_LINKS";
  };
};

/**
 * Creates a submission-time complaint feature vector.
 *
 * This service:
 * - Uses complaint data and image metadata only.
 * - Counts only images uploaded at or before complaint.createdAt.
 * - Does not use later officer establishment links.
 * - Does not use image-analysis findings or triage outputs.
 * - Does not generate labels, predictions, or risk scores.
 * - Preserves unknown values as null.
 */
export async function buildComplaintMlFeatureVectorV2(
  complaintId: number,
  db: ComplaintFeatureDb = prisma
): Promise<ComplaintMlFeatureVectorV2> {
  if (!Number.isSafeInteger(complaintId) || complaintId <= 0) {
    throw new Error("A valid complaint ID is required.");
  }

  const complaint = await db.complaint.findUnique({
    where: { id: complaintId },
    select: {
      id: true,
      title: true,
      description: true,
      foodType: true,
      incidentDate: true,
      createdAt: true,
      images: {
        select: {
          id: true,
          uploadedAt: true,
        },
      },
    },
  });

  if (!complaint) {
    throw new Error("Complaint not found.");
  }

  const submissionTime = complaint.createdAt;

  const submissionTimeImages = complaint.images.filter(
    (image) => image.uploadedAt.getTime() <= submissionTime.getTime()
  );

  const incidentSubmissionDelayDays = daysBetween(
    complaint.incidentDate,
    submissionTime
  );

  return {
    featureVersion: COMPLAINT_ML_FEATURE_VERSION_V2,

    features: {
      title: complaint.title,
      description: complaint.description,
      foodType: complaint.foodType,

      // The current workflow links establishments after submission.
      // Never infer identity from establishmentName or a later link.
      district: null,
      establishmentType: null,

      photoCount: submissionTimeImages.length,

      incidentSubmissionDelayDays,

      // No establishment identity was linked at submission.
      previousComplaintCount: null,
      previousComplaints30dCount: null,
    },

    missingness: {
      establishmentLinkMissingAtSubmission: true,
      districtMissing: true,
      establishmentTypeMissing: true,
      establishmentHistoryMissing: true,
      incidentSubmissionDelayMissing:
        incidentSubmissionDelayDays === null,
    },

    interpretation: {
      complaintReportsAreUnverified: true,
      establishmentIdentityResolvedAtSubmission: false,
      predictionPermitted: false,

      reason:
        "Submission-time feature snapshot only. The current complaint workflow does not link an establishment at submission. Later officer links, image analyses, triage outputs, and unverified complaint allegations are excluded. Independent verified outcome labels and a validated training dataset are not available.",
    },

    provenance: {
      extractorVersion: "complaint-feature-extractor-v2",
      featureContractVersion: COMPLAINT_ML_FEATURE_VERSION_V2,
      snapshotPolicy: "SUBMISSION_TIME",
      imageCutoff:
        "UPLOADED_AT_LESS_THAN_OR_EQUAL_TO_COMPLAINT_CREATED_AT",
      establishmentContextPolicy: "NO_POST_SUBMISSION_LINKS",
    },
  };
}