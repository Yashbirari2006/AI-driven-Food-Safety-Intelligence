
import type { Request, Response } from "express";
import {
  InspectionMeasurementField,
  InspectionMeasurementStatus,
  InspectionStatus,
  Prisma,
} from "@prisma/client";

import prisma from "../lib/prisma";
import { writeInspectionMeasurementAudit } from "../utils/inspectionMeasurementAudit";

interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    role: string;
  };
}

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

const allowedFields = Object.values(InspectionMeasurementField);

function getPositiveId(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function getRequiredText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length > 0 ? result : null;
}

function getOptionalText(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return null;
  return value.trim() || undefined;
}

function getObservedAt(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isValidJsonValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;

  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) return false;

    const parsed: unknown = JSON.parse(serialized);
    return parsed !== null;
  } catch {
    return false;
  }
}

function getMeasurementInput(body: any) {
  const fieldKey = body?.fieldKey;

  if (
    typeof fieldKey !== "string" ||
    !allowedFields.includes(fieldKey as InspectionMeasurementField)
  ) {
    throw new ApiError(400, "Invalid measurement fieldKey.");
  }

  if (!isValidJsonValue(body?.value)) {
    throw new ApiError(400, "A valid non-null measurement value is required.");
  }

  const method = getRequiredText(body?.method);
  if (!method) {
    throw new ApiError(400, "Measurement method is required.");
  }

  const observedAt = getObservedAt(body?.observedAt);
  if (!observedAt) {
    throw new ApiError(400, "A valid observedAt date is required.");
  }

  const unit = getOptionalText(body?.unit);
  const protocolReference = getOptionalText(body?.protocolReference);
  const sourceReference = getOptionalText(body?.sourceReference);

  if (unit === null || protocolReference === null || sourceReference === null) {
    throw new ApiError(400, "Optional text fields must be strings.");
  }

  return {
    fieldKey: fieldKey as InspectionMeasurementField,
    value: body.value as Prisma.InputJsonValue,
    method,
    observedAt,
    ...(unit !== undefined ? { unit } : {}),
    ...(protocolReference !== undefined ? { protocolReference } : {}),
    ...(sourceReference !== undefined ? { sourceReference } : {}),
  };
}

function handleError(res: Response, error: unknown) {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Inspection measurement error:", error);

  return res.status(500).json({
    success: false,
    message: "An internal server error occurred.",
  });
}

// 1. RECORD INSPECTION MEASUREMENT
export async function recordInspectionMeasurement(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.userId;
    const inspectionId = getPositiveId(req.params.id);

    if (!userId) {
      throw new ApiError(401, "Authentication required.");
    }

    if (!inspectionId) {
      throw new ApiError(400, "Invalid inspection ID.");
    }

    if (req.user?.role !== "FOOD_SAFETY_OFFICER") {
      throw new ApiError(403, "Only food safety officers can record measurements.");
    }

    const input = getMeasurementInput(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const inspection = await tx.inspection.findUnique({
        where: { id: inspectionId },
        select: {
          id: true,
          complaintId: true,
          assignedOfficerId: true,
          status: true,
        },
      });

      if (!inspection) {
        throw new ApiError(404, "Inspection not found.");
      }

      if (inspection.assignedOfficerId !== userId) {
        throw new ApiError(403, "You are not assigned to this inspection.");
      }

      if (
        inspection.status === InspectionStatus.COMPLETED ||
        inspection.status === InspectionStatus.CANCELLED
      ) {
        throw new ApiError(409, "Measurements cannot be recorded for this inspection.");
      }

      const measurement = await tx.inspectionMeasurement.create({
        data: {
          inspectionId,
          ...input,
          recordedById: userId,
          verificationStatus: InspectionMeasurementStatus.PENDING,
        },
      });

      await writeInspectionMeasurementAudit(tx, {
        actorId: userId,
        complaintId: inspection.complaintId,
        measurementId: measurement.id,
        action: "INSPECTION_MEASUREMENT_RECORDED",
        details: {
          inspectionId,
          fieldKey: measurement.fieldKey,
          verificationStatus: measurement.verificationStatus,
        },
      });

      return measurement;
    });

    return res.status(201).json({
      success: true,
      message: "Inspection measurement recorded successfully.",
      data: result,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

// 2. GET INSPECTION MEASUREMENT HISTORY
export async function getInspectionMeasurements(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.userId;
    const inspectionId = getPositiveId(req.params.id);

    if (!userId) {
      throw new ApiError(401, "Authentication required.");
    }

    if (!inspectionId) {
      throw new ApiError(400, "Invalid inspection ID.");
    }

    if (!["FOOD_SAFETY_OFFICER", "SUPERVISOR"].includes(req.user?.role ?? "")) {
      throw new ApiError(403, "You are not authorized to view measurements.");
    }

    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        complaintId: true,
        assignedOfficerId: true,
      },
    });

    if (!inspection) {
      throw new ApiError(404, "Inspection not found.");
    }

    if (
      req.user?.role === "FOOD_SAFETY_OFFICER" &&
      inspection.assignedOfficerId !== userId
    ) {
      throw new ApiError(403, "You are not assigned to this inspection.");
    }

    const measurements = await prisma.inspectionMeasurement.findMany({
      where: { inspectionId },
      include: {
        recordedBy: {
          select: { id: true, name: true, email: true },
        },
        verifiedBy: {
          select: { id: true, name: true, email: true },
        },
        supersedes: {
          select: { id: true, fieldKey: true, createdAt: true },
        },
        supersededBy: {
          select: { id: true, fieldKey: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      success: true,
      data: {
        inspectionId,
        complaintId: inspection.complaintId,
        total: measurements.length,
        measurements,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
}

// 3. VERIFY OR REJECT A MEASUREMENT
export async function reviewInspectionMeasurement(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.userId;
    const measurementId = getPositiveId(req.params.measurementId);

    if (!userId) {
      throw new ApiError(401, "Authentication required.");
    }

    if (!measurementId) {
      throw new ApiError(400, "Invalid measurement ID.");
    }

    if (req.user?.role !== "SUPERVISOR") {
      throw new ApiError(403, "Only supervisors can review measurements.");
    }

    const decision = req.body?.decision;

    if (
      decision !== InspectionMeasurementStatus.VERIFIED &&
      decision !== InspectionMeasurementStatus.REJECTED
    ) {
      throw new ApiError(400, "Decision must be VERIFIED or REJECTED.");
    }

    const reviewNote = getOptionalText(req.body?.reviewNote);

    if (reviewNote === null) {
      throw new ApiError(400, "Review note must be a string.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.inspectionMeasurement.findUnique({
        where: { id: measurementId },
        include: {
          inspection: {
            select: { complaintId: true },
          },
        },
      });

      if (!existing) {
        throw new ApiError(404, "Measurement not found.");
      }

      if (existing.verificationStatus !== InspectionMeasurementStatus.PENDING) {
        throw new ApiError(409, "Only pending measurements can be reviewed.");
      }

      const updated = await tx.inspectionMeasurement.updateMany({
        where: {
          id: measurementId,
          verificationStatus: InspectionMeasurementStatus.PENDING,
        },
        data: {
          verificationStatus: decision,
          verifiedById: userId,
          verifiedAt: new Date(),
          reviewNote: reviewNote ?? null,
        },
      });

      if (updated.count !== 1) {
        throw new ApiError(409, "Measurement has already been reviewed.");
      }

      const measurement = await tx.inspectionMeasurement.findUniqueOrThrow({
        where: { id: measurementId },
      });

      await writeInspectionMeasurementAudit(tx, {
        actorId: userId,
        complaintId: existing.inspection.complaintId,
        measurementId,
        action:
          decision === InspectionMeasurementStatus.VERIFIED
            ? "INSPECTION_MEASUREMENT_VERIFIED"
            : "INSPECTION_MEASUREMENT_REJECTED",
        details: {
          decision,
          reviewNote: reviewNote ?? null,
        },
      });

      return measurement;
    });

    return res.status(200).json({
      success: true,
      message: `Measurement ${decision.toLowerCase()} successfully.`,
      data: result,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

// 4. CREATE A REVISION WITHOUT OVERWRITING ORIGINAL DATA
export async function reviseInspectionMeasurement(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.userId;
    const inspectionId = getPositiveId(req.params.id);
    const measurementId = getPositiveId(req.params.measurementId);

    if (!userId) {
      throw new ApiError(401, "Authentication required.");
    }

    if (!inspectionId || !measurementId) {
      throw new ApiError(400, "Invalid inspection or measurement ID.");
    }

    if (req.user?.role !== "FOOD_SAFETY_OFFICER") {
      throw new ApiError(403, "Only food safety officers can submit revisions.");
    }

    const input = getMeasurementInput(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const inspection = await tx.inspection.findUnique({
        where: { id: inspectionId },
        select: {
          id: true,
          complaintId: true,
          assignedOfficerId: true,
          status: true,
        },
      });

      if (!inspection) {
        throw new ApiError(404, "Inspection not found.");
      }

      if (inspection.assignedOfficerId !== userId) {
        throw new ApiError(403, "You are not assigned to this inspection.");
      }

      if (
        inspection.status === InspectionStatus.COMPLETED ||
        inspection.status === InspectionStatus.CANCELLED
      ) {
        throw new ApiError(409, "This inspection cannot be revised.");
      }

      const previous = await tx.inspectionMeasurement.findFirst({
        where: {
          id: measurementId,
          inspectionId,
        },
        include: {
          supersededBy: {
            select: { id: true },
          },
        },
      });

      if (!previous) {
        throw new ApiError(404, "Measurement not found in this inspection.");
      }

      if (previous.verificationStatus !== InspectionMeasurementStatus.VERIFIED) {
        throw new ApiError(409, "Only verified measurements can be revised.");
      }

      if (previous.supersededBy) {
        throw new ApiError(409, "This measurement already has a revision.");
      }

      if (input.fieldKey !== previous.fieldKey) {
        throw new ApiError(400, "A revision must retain the original measurement field.");
      }

      const revision = await tx.inspectionMeasurement.create({
        data: {
          inspectionId,
          ...input,
          recordedById: userId,
          verificationStatus: InspectionMeasurementStatus.PENDING,
          supersedesId: previous.id,
        },
      });

      await writeInspectionMeasurementAudit(tx, {
        actorId: userId,
        complaintId: inspection.complaintId,
        measurementId: revision.id,
        action: "INSPECTION_MEASUREMENT_REVISED",
        details: {
          inspectionId,
          previousMeasurementId: previous.id,
          newMeasurementId: revision.id,
          verificationStatus: InspectionMeasurementStatus.PENDING,
        },
      });

      return revision;
    });

    return res.status(201).json({
      success: true,
      message: "Measurement revision submitted successfully.",
      data: result,
    });
  } catch (error) {
    return handleError(res, error);
  }
}
