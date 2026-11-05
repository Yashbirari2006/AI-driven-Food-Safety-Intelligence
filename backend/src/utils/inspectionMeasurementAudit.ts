import type { Prisma } from "@prisma/client";

type InspectionMeasurementAuditInput = {
  actorId: number;
  complaintId: number;
  measurementId: number;
  action: string;
  details?: Prisma.InputJsonValue;
};

export async function writeInspectionMeasurementAudit(
  tx: Prisma.TransactionClient,
  input: InspectionMeasurementAuditInput
) {
  return tx.auditLog.create({
    data: {
      actorId: input.actorId,
      complaintId: input.complaintId,
      action: input.action,
      entityType: "INSPECTION_MEASUREMENT",
      entityId: String(input.measurementId),
      ...(input.details !== undefined
        ? { details: input.details }
        : {}),
    },
  });
}