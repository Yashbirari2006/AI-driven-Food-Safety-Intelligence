
import type { Request, Response } from "express";
import prisma from "../lib/prisma";

type AuthenticatedRequest = Request & {
  user?: {
    userId: number;
    role: string;
  };
};

const allowedFinalizers = ["FOOD_SAFETY_OFFICER", "SUPERVISOR"] as const;

type OutcomeError =
  | "COMPLAINT_NOT_FOUND"
  | "INVALID_REVISION_TARGET"
  | "ASSESSMENT_NOT_FOUND"
  | "ASSESSMENT_FINAL"
  | "COMPLAINT_NOT_LINKED"
  | "SOURCE_NOT_VERIFIED"
  | "EVIDENCE_NOT_FOUND"
  | "EVIDENCE_ALREADY_REVIEWED"
  | "UNSUPPORTED_SOURCE"
  | "ALREADY_FINAL"
  | "VERIFIED_EVIDENCE_REQUIRED";

type FinalOutcome =
  | "SUBSTANTIATED"
  | "NOT_SUBSTANTIATED"
  | "INCONCLUSIVE";

const errorMessages: Record<
  OutcomeError,
  { status: number; message: string }
> = {
  COMPLAINT_NOT_FOUND: {
    status: 404,
    message: "Complaint not found.",
  },
  INVALID_REVISION_TARGET: {
    status: 400,
    message:
      "The revision target must be a final assessment for this complaint that has not already been superseded.",
  },
  ASSESSMENT_NOT_FOUND: {
    status: 404,
    message: "Outcome assessment not found.",
  },
  ASSESSMENT_FINAL: {
    status: 409,
    message:
      "This assessment is finalized. Create a revision instead of changing its evidence.",
  },
  COMPLAINT_NOT_LINKED: {
    status: 409,
    message:
      "Link the complaint to an establishment before attaching this evidence.",
  },
  SOURCE_NOT_VERIFIED: {
    status: 400,
    message:
      "The referenced establishment record is not verified or is not linked to this complaint's establishment.",
  },
  EVIDENCE_NOT_FOUND: {
    status: 404,
    message: "Outcome evidence not found.",
  },
  EVIDENCE_ALREADY_REVIEWED: {
    status: 409,
    message:
      "This evidence has already been reviewed. Add a new evidence entry if necessary.",
  },
  UNSUPPORTED_SOURCE: {
    status: 400,
    message:
      "This evidence source cannot be independently verified by the current implementation.",
  },
  ALREADY_FINAL: {
    status: 409,
    message:
      "This assessment is already finalized. Create a revision to correct it.",
  },
  VERIFIED_EVIDENCE_REQUIRED: {
    status: 400,
    message:
      "At least one independently verified evidence record is required for SUBSTANTIATED or NOT_SUBSTANTIATED outcomes.",
  },
};

function getPositiveId(value: unknown): number | null {
  if (typeof value !== "string") return null;
  if (!/^[1-9]\d*$/.test(value)) return null;

  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function getText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const text = value.trim();
  return text.length > 0 ? text : null;
}

function canFinalize(role: string | undefined): boolean {
  return (
    !!role &&
    allowedFinalizers.includes(
      role as (typeof allowedFinalizers)[number]
    )
  );
}

function isFinalOutcome(value: unknown): value is FinalOutcome {
  return (
    value === "SUBSTANTIATED" ||
    value === "NOT_SUBSTANTIATED" ||
    value === "INCONCLUSIVE"
  );
}

function getOutcomeErrorResponse(
  res: Response,
  error: OutcomeError
) {
  const response = errorMessages[error];

  return res.status(response.status).json({
    message: response.message,
  });
}

function isBinaryOutcome(outcome: string): boolean {
  return (
    outcome === "SUBSTANTIATED" ||
    outcome === "NOT_SUBSTANTIATED"
  );
}

/**
 * POST /api/complaints/officer/:id/outcomes
 *
 * Creates a PENDING assessment.
 * A revision can supersede an existing final assessment.
 */
export async function createComplaintOutcomeAssessment(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const complaintId = getPositiveId(req.params.id);
    const userId = req.user?.userId;

    if (!complaintId) {
      return res.status(400).json({
        message: "Invalid complaint ID.",
      });
    }

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    if (!canFinalize(req.user?.role)) {
      return res.status(403).json({
        message: "You are not authorized to record outcome assessments.",
      });
    }

    const determination = getText(req.body?.determination);

    if (!determination || determination.length < 10) {
      return res.status(400).json({
        message:
          "Provide a meaningful determination note of at least 10 characters.",
      });
    }

    const rawSupersedesId = req.body?.supersedesAssessmentId;
    let supersedesAssessmentId: number | null = null;

    if (rawSupersedesId !== undefined && rawSupersedesId !== null) {
      if (
        typeof rawSupersedesId !== "number" &&
        typeof rawSupersedesId !== "string"
      ) {
        return res.status(400).json({
          message: "Invalid supersedesAssessmentId.",
        });
      }

      const parsedId = Number(rawSupersedesId);

      if (!Number.isSafeInteger(parsedId) || parsedId <= 0) {
        return res.status(400).json({
          message: "Invalid supersedesAssessmentId.",
        });
      }

      supersedesAssessmentId = parsedId;
    }

    const result = await prisma.$transaction(async (tx) => {
      const complaint = await tx.complaint.findUnique({
        where: { id: complaintId },
        select: { id: true },
      });

      if (!complaint) {
        return { error: "COMPLAINT_NOT_FOUND" as const };
      }

      if (supersedesAssessmentId !== null) {
        const previous =
          await tx.complaintOutcomeAssessment.findUnique({
            where: { id: supersedesAssessmentId },
            include: {
              supersededBy: {
                select: { id: true },
              },
            },
          });

        if (
          !previous ||
          previous.complaintId !== complaintId ||
          !previous.isFinal ||
          previous.supersededBy
        ) {
          return { error: "INVALID_REVISION_TARGET" as const };
        }
      }

      const assessment =
        await tx.complaintOutcomeAssessment.create({
          data: {
            complaintId,
            outcome: "PENDING",
            determination,
            isFinal: false,
            recordedById: userId,
            supersedesAssessmentId,
            labelPolicyVersion: "complaint-outcome-v1",
          },
          include: {
            recordedBy: {
              select: { id: true, name: true, role: true },
            },
            supersedes: {
              select: {
                id: true,
                outcome: true,
                finalizedAt: true,
              },
            },
          },
        });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          complaintId,
          action: "COMPLAINT_OUTCOME_ASSESSMENT_CREATED",
          entityType: "ComplaintOutcomeAssessment",
          entityId: String(assessment.id),
          details: {
            outcome: "PENDING",
            supersedesAssessmentId,
            labelPolicyVersion: "complaint-outcome-v1",
          },
        },
      });

      return { assessment };
    });

    if ("error" in result && result.error) {
  return getOutcomeErrorResponse(res, result.error);
}
    return res.status(201).json({
      message: "Pending complaint outcome assessment created.",
      assessment: result.assessment,
      trainingEligible: false,
    });
  } catch (error) {
    console.error("Create complaint outcome assessment error:", error);

    return res.status(500).json({
      message: "Unable to create outcome assessment.",
    });
  }
}

/**
 * POST /api/complaints/officer/outcomes/:assessmentId/evidence
 *
 * Currently supports only verified EstablishmentRecord evidence.
 */
export async function attachComplaintOutcomeEvidence(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const assessmentId = getPositiveId(req.params.assessmentId);
    const userId = req.user?.userId;

    if (!assessmentId) {
      return res.status(400).json({
        message: "Invalid assessment ID.",
      });
    }

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    if (!canFinalize(req.user?.role)) {
      return res.status(403).json({
        message: "You are not authorized to attach outcome evidence.",
      });
    }

    const sourceType = req.body?.sourceType;
    const sourceReference = getText(req.body?.sourceReference);
    const description = getText(req.body?.description);

    if (sourceType !== "VERIFIED_ESTABLISHMENT_RECORD") {
      return res.status(400).json({
        message:
          "This version accepts only VERIFIED_ESTABLISHMENT_RECORD evidence. Inspection and laboratory evidence are not yet supported by independently verifiable source models.",
      });
    }

    if (!sourceReference || !/^[1-9]\d*$/.test(sourceReference)) {
      return res.status(400).json({
        message:
          "sourceReference must be the numeric ID of an establishment record.",
      });
    }

    const recordId = Number(sourceReference);

    if (!Number.isSafeInteger(recordId)) {
      return res.status(400).json({
        message: "Invalid establishment record ID.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const assessment =
        await tx.complaintOutcomeAssessment.findUnique({
          where: { id: assessmentId },
          include: {
            complaint: {
              select: { id: true, establishmentId: true },
            },
          },
        });

      if (!assessment) {
        return { error: "ASSESSMENT_NOT_FOUND" as const };
      }

      if (assessment.isFinal) {
        return { error: "ASSESSMENT_FINAL" as const };
      }

      if (!assessment.complaint.establishmentId) {
        return { error: "COMPLAINT_NOT_LINKED" as const };
      }

      const record = await tx.establishmentRecord.findFirst({
        where: {
          id: recordId,
          establishmentId: assessment.complaint.establishmentId,
          verified: true,
        },
        select: { id: true },
      });

      if (!record) {
        return { error: "SOURCE_NOT_VERIFIED" as const };
      }

      const evidence = await tx.complaintOutcomeEvidence.create({
        data: {
          assessmentId,
          sourceType: "VERIFIED_ESTABLISHMENT_RECORD",
          sourceReference,
          description,
          verificationStatus: "PENDING",
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          complaintId: assessment.complaintId,
          action: "COMPLAINT_OUTCOME_EVIDENCE_ATTACHED",
          entityType: "ComplaintOutcomeEvidence",
          entityId: String(evidence.id),
          details: {
            assessmentId,
            sourceType,
            sourceReference,
            initialVerificationStatus: "PENDING",
          },
        },
      });

      return { evidence };
    });

    if ("error" in result && result.error) {
  return getOutcomeErrorResponse(res, result.error);
}

    return res.status(201).json({
      message:
        "Evidence attached. It is pending review and is not yet counted as verified evidence.",
      evidence: result.evidence,
    });
  } catch (error) {
    console.error("Attach complaint outcome evidence error:", error);

    return res.status(500).json({
      message: "Unable to attach outcome evidence.",
    });
  }
}

/**
 * PATCH /api/complaints/officer/outcomes/evidence/:evidenceId/review
 *
 * Body: { "decision": "VERIFIED" } or { "decision": "REJECTED" }
 */
export async function reviewComplaintOutcomeEvidence(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const evidenceId = getPositiveId(req.params.evidenceId);
    const userId = req.user?.userId;

    if (!evidenceId) {
      return res.status(400).json({
        message: "Invalid evidence ID.",
      });
    }

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    if (!canFinalize(req.user?.role)) {
      return res.status(403).json({
        message: "You are not authorized to review outcome evidence.",
      });
    }

    const decision = req.body?.decision;

    if (decision !== "VERIFIED" && decision !== "REJECTED") {
      return res.status(400).json({
        message: 'decision must be either "VERIFIED" or "REJECTED".',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const evidence = await tx.complaintOutcomeEvidence.findUnique({
        where: { id: evidenceId },
        include: {
          assessment: {
            include: {
              complaint: {
                select: { id: true, establishmentId: true },
              },
            },
          },
        },
      });

      if (!evidence) {
        return { error: "EVIDENCE_NOT_FOUND" as const };
      }

      if (evidence.assessment.isFinal) {
        return { error: "ASSESSMENT_FINAL" as const };
      }

      if (evidence.verificationStatus !== "PENDING") {
        return { error: "EVIDENCE_ALREADY_REVIEWED" as const };
      }

      if (decision === "VERIFIED") {
        if (
          evidence.sourceType !== "VERIFIED_ESTABLISHMENT_RECORD" ||
          !evidence.assessment.complaint.establishmentId
        ) {
          return { error: "UNSUPPORTED_SOURCE" as const };
        }

        const recordId = Number(evidence.sourceReference);

        const record = await tx.establishmentRecord.findFirst({
          where: {
            id: recordId,
            establishmentId:
              evidence.assessment.complaint.establishmentId,
            verified: true,
          },
          select: { id: true },
        });

        if (!record) {
          return { error: "SOURCE_NOT_VERIFIED" as const };
        }
      }

      // Conditional update prevents reviewing an already-reviewed row.
      const updateResult =
        await tx.complaintOutcomeEvidence.updateMany({
          where: {
            id: evidenceId,
            verificationStatus: "PENDING",
          },
          data: {
            verificationStatus: decision,
            verifiedById: userId,
            // A rejected record was reviewed, but was not verified.
            verifiedAt:
              decision === "VERIFIED" ? new Date() : null,
          },
        });

      if (updateResult.count !== 1) {
        return { error: "EVIDENCE_ALREADY_REVIEWED" as const };
      }

      const updated = await tx.complaintOutcomeEvidence.findUnique({
        where: { id: evidenceId },
      });

      if (!updated) {
        return { error: "EVIDENCE_NOT_FOUND" as const };
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          complaintId: evidence.assessment.complaintId,
          action:
            decision === "VERIFIED"
              ? "COMPLAINT_OUTCOME_EVIDENCE_VERIFIED"
              : "COMPLAINT_OUTCOME_EVIDENCE_REJECTED",
          entityType: "ComplaintOutcomeEvidence",
          entityId: String(evidenceId),
          details: {
            assessmentId: evidence.assessmentId,
            decision,
            sourceType: evidence.sourceType,
            sourceReference: evidence.sourceReference,
          },
        },
      });

      return { evidence: updated };
    });

    if ("error" in result && result.error) {
  return getOutcomeErrorResponse(res, result.error);
}

    return res.status(200).json({
      message: `Outcome evidence marked ${decision}.`,
      evidence: result.evidence,
    });
  } catch (error) {
    console.error("Review complaint outcome evidence error:", error);

    return res.status(500).json({
      message: "Unable to review outcome evidence.",
    });
  }
}

/**
 * PATCH /api/complaints/officer/outcomes/:assessmentId/finalize
 *
 * Body:
 * {
 *   "outcome": "SUBSTANTIATED" | "NOT_SUBSTANTIATED" | "INCONCLUSIVE",
 *   "determination": "..."
 * }
 */
export async function finalizeComplaintOutcomeAssessment(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const assessmentId = getPositiveId(req.params.assessmentId);
    const userId = req.user?.userId;

    if (!assessmentId) {
      return res.status(400).json({
        message: "Invalid assessment ID.",
      });
    }

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    if (!canFinalize(req.user?.role)) {
      return res.status(403).json({
        message:
          "Only an authorized officer or supervisor can finalize an outcome.",
      });
    }

    const outcome = req.body?.outcome;
    const determination = getText(req.body?.determination);

    if (!isFinalOutcome(outcome)) {
      return res.status(400).json({
        message:
          "outcome must be SUBSTANTIATED, NOT_SUBSTANTIATED, or INCONCLUSIVE.",
      });
    }

    if (!determination || determination.length < 10) {
      return res.status(400).json({
        message:
          "Provide a meaningful final determination of at least 10 characters.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const assessment =
        await tx.complaintOutcomeAssessment.findUnique({
          where: { id: assessmentId },
          include: {
            evidence: {
              where: { verificationStatus: "VERIFIED" },
              select: { id: true },
            },
            supersededBy: {
              select: { id: true },
            },
          },
        });

      if (!assessment) {
        return { error: "ASSESSMENT_NOT_FOUND" as const };
      }

      if (assessment.isFinal) {
        return { error: "ALREADY_FINAL" as const };
      }

      if (assessment.supersededBy) {
        return { error: "INVALID_REVISION_TARGET" as const };
      }

      if (
        isBinaryOutcome(outcome) &&
        assessment.evidence.length === 0
      ) {
        return { error: "VERIFIED_EVIDENCE_REQUIRED" as const };
      }

      // Conditional update prevents two requests from finalizing
      // the same assessment at the same time.
      const updateResult =
        await tx.complaintOutcomeAssessment.updateMany({
          where: {
            id: assessmentId,
            isFinal: false,
          },
          data: {
            outcome,
            determination,
            isFinal: true,
            finalizedAt: new Date(),
            finalizedById: userId,
          },
        });

      if (updateResult.count !== 1) {
        return { error: "ALREADY_FINAL" as const };
      }

      const updated =
        await tx.complaintOutcomeAssessment.findUnique({
          where: { id: assessmentId },
          include: {
            evidence: true,
            recordedBy: {
              select: { id: true, name: true, role: true },
            },
            finalizedBy: {
              select: { id: true, name: true, role: true },
            },
            supersededBy: {
              select: { id: true },
            },
          },
        });

      if (!updated) {
        return { error: "ASSESSMENT_NOT_FOUND" as const };
      }

      const trainingEligible =
        isBinaryOutcome(updated.outcome) &&
        updated.isFinal &&
        !!updated.finalizedById &&
        !updated.supersededBy &&
        updated.evidence.some(
          (item) => item.verificationStatus === "VERIFIED"
        );

      await tx.auditLog.create({
        data: {
          actorId: userId,
          complaintId: assessment.complaintId,
          action: "COMPLAINT_OUTCOME_ASSESSMENT_FINALIZED",
          entityType: "ComplaintOutcomeAssessment",
          entityId: String(assessmentId),
          details: {
            outcome,
            verifiedEvidenceCount: assessment.evidence.length,
            labelPolicyVersion: assessment.labelPolicyVersion,
            trainingEligible,
          },
        },
      });

      return {
        assessment: updated,
        trainingEligible,
      };
    });

    if ("error" in result && result.error) {
  return getOutcomeErrorResponse(res, result.error);
}

    const finalOutcome = result.assessment.outcome;

    return res.status(200).json({
      message: "Complaint outcome assessment finalized.",
      assessment: result.assessment,
      trainingEligible: result.trainingEligible,
      trainingEligibilityNote: result.trainingEligible
        ? "Eligible for future reviewed training-data export under the current label policy. This does not mean a model has been trained."
        : "Not eligible for binary complaint-outcome training.",
      interpretation:
        finalOutcome === "NOT_SUBSTANTIATED"
          ? "This means the reported concern was not established by the available investigation evidence. It does not establish that the food was safe or that the complainant made a false report."
          : finalOutcome === "INCONCLUSIVE"
            ? "Available evidence was insufficient to determine whether the complaint was substantiated."
            : "The investigation evidence supports the reported concern. This is an investigation outcome, not an automatic food-safety risk score.",
    });
  } catch (error) {
    console.error("Finalize complaint outcome assessment error:", error);

    return res.status(500).json({
      message: "Unable to finalize complaint outcome assessment.",
    });
  }
}

/**
 * GET /api/complaints/officer/:id/outcomes
 *
 * Returns the complete assessment history for one complaint.
 */
export async function getComplaintOutcomeHistory(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const complaintId = getPositiveId(req.params.id);

    if (!complaintId) {
      return res.status(400).json({
        message: "Invalid complaint ID.",
      });
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: { id: true },
    });

    if (!complaint) {
      return res.status(404).json({
        message: "Complaint not found.",
      });
    }

    const assessments =
      await prisma.complaintOutcomeAssessment.findMany({
        where: { complaintId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          recordedBy: {
            select: { id: true, name: true, role: true },
          },
          finalizedBy: {
            select: { id: true, name: true, role: true },
          },
          supersedes: {
            select: {
              id: true,
              outcome: true,
              finalizedAt: true,
            },
          },
          supersededBy: {
            select: {
              id: true,
              outcome: true,
              finalizedAt: true,
            },
          },
          evidence: {
            include: {
              verifiedBy: {
                select: { id: true, name: true, role: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

    const history = assessments.map((assessment) => {
      const hasVerifiedEvidence = assessment.evidence.some(
        (item) => item.verificationStatus === "VERIFIED"
      );

      const trainingEligible =
        assessment.isFinal &&
        !assessment.supersededBy &&
        isBinaryOutcome(assessment.outcome) &&
        hasVerifiedEvidence &&
        !!assessment.finalizedById;

      return {
        ...assessment,
        trainingEligible,
      };
    });

    return res.status(200).json({
      complaintId,
      count: history.length,
      assessments: history,
      note:
        "Training eligibility is derived from final outcome, verified evidence, authorized finalization, and revision history. It is not a model prediction.",
    });
  } catch (error) {
    console.error("Get complaint outcome history error:", error);

    return res.status(500).json({
      message: "Unable to retrieve complaint outcome history.",
    });
  }
}
