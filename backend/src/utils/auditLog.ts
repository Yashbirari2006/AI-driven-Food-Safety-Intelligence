import type { Prisma } from "@prisma/client";

type AuditLogInput = {
  actorId: number;
  complaintId: number;
  action: string;
  details?: Prisma.InputJsonValue;
};

export async function writeComplaintAudit(
  tx: Prisma.TransactionClient,
  input: AuditLogInput
) {
  return tx.auditLog.create({
    data: {
      actorId: input.actorId,
      complaintId: input.complaintId,
      action: input.action,
      entityType: "COMPLAINT",
      entityId: String(input.complaintId),
      ...(input.details !== undefined
        ? { details: input.details }
        : {}),
    },
  });
}