
import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

import prisma from "../lib/prisma";
import { writeComplaintAudit } from "../utils/auditLog";
import { evaluateComplaintTriage } from "../services/triageService";
import { Prisma } from "@prisma/client";

interface AuthRequest extends Request {
  user?: {
    userId: number;
    role: string;
  };
}

const UPLOAD_DIR = path.resolve(
  process.cwd(),
  "uploads",
  "complaints"
);

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 1024 * 1024;

function formatComplaintReference(
  id: number,
  createdAt: Date
): string {
  const year = createdAt.getFullYear();

  return `FSI-${year}-${String(id).padStart(5, "0")}`;
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

type SavedPhoto = {
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
};

// Validate incoming Base64 images and prepare them for storage.
function parsePhotos(value: unknown): SavedPhoto[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value) || value.length > MAX_PHOTOS) {
    throw new Error(
      `You can upload a maximum of ${MAX_PHOTOS} photos.`
    );
  }

  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`Photo ${index + 1} is invalid.`);
    }

    const match = item.match(
      /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]*={0,2})$/
    );

    if (!match) {
      throw new Error(
        `Photo ${index + 1} must be a JPEG, PNG or WebP image.`
      );
    }

    const mimeType = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, "base64");

    if (
      buffer.length === 0 ||
      buffer.length > MAX_PHOTO_BYTES ||
      buffer.toString("base64") !== base64
    ) {
      throw new Error(
        `Photo ${index + 1} is invalid or exceeds the 1 MB limit.`
      );
    }

    const isJpeg =
      mimeType === "image/jpeg" &&
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;

    const isPng =
      mimeType === "image/png" &&
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([
          137, 80, 78, 71, 13, 10, 26, 10,
        ])
      );

    const isWebp =
      mimeType === "image/webp" &&
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP";

    if (!isJpeg && !isPng && !isWebp) {
      throw new Error(
        `Photo ${index + 1} has an invalid image signature.`
      );
    }

    const extension =
      mimeType === "image/jpeg"
        ? ".jpg"
        : mimeType === "image/png"
          ? ".png"
          : ".webp";

    return {
      storageKey: `${randomUUID()}${extension}`,
      originalFilename: `complaint-photo-${index + 1}${extension}`,
      mimeType,
      sizeBytes: buffer.length,
      buffer,
    };
  });
}

function getImageUrl(storageKey: string): string {
  return `/uploads/complaints/${encodeURIComponent(storageKey)}`;
}

// Submit a complaint and persist its supporting images.
export const createComplaint = async (
  req: AuthRequest,
  res: Response
) => {
  const writtenFiles: string[] = [];

  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const {
      title,
      description,
      foodType,
      establishmentName,
      location,
      incidentDate,
    } = req.body;

    if (
      !title ||
      !description ||
      !foodType ||
      !establishmentName ||
      !location ||
      !incidentDate
    ) {
      return res.status(400).json({
        message: "All complaint fields are required",
      });
    }

    if (
      typeof title !== "string" ||
      typeof description !== "string" ||
      typeof foodType !== "string" ||
      typeof establishmentName !== "string" ||
      typeof location !== "string" ||
      typeof incidentDate !== "string"
    ) {
      return res.status(400).json({
        message: "Invalid complaint field types",
      });
    }

    const parsedIncidentDate = new Date(incidentDate);

    if (Number.isNaN(parsedIncidentDate.getTime())) {
      return res.status(400).json({
        message: "A valid incidentDate is required",
      });
    }

    let photos: SavedPhoto[];

    try {
      photos = parsePhotos(req.body.photos);
    } catch (error) {
      return res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Invalid photos",
      });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    // Write image files before creating database records.
    for (const photo of photos) {
      const filePath = path.join(
        UPLOAD_DIR,
        photo.storageKey
      );

      await writeFile(filePath, photo.buffer, {
        flag: "wx",
      });

      writtenFiles.push(filePath);
    }

    const triage = evaluateComplaintTriage({
      title: title.trim(),
      description: description.trim(),
      foodType: foodType.trim(),
      photoCount: photos.length,
    });

    const complaint = await prisma.$transaction(async (tx) => {
      const createdComplaint = await tx.complaint.create({
        data: {
          citizenId: req.user!.userId,
          title: title.trim(),
          description: description.trim(),
          foodType: foodType.trim(),
          establishmentName: establishmentName.trim(),
          location: location.trim(),
          incidentDate: parsedIncidentDate,
        },
      });

      const savedTriage = await tx.complaintTriage.create({
        data: {
          complaintId: createdComplaint.id,
          urgency: triage.urgency,
          actionability: triage.actionability,
          reasons: triage.reasons as Prisma.InputJsonValue,
          inputSnapshot: triage.inputSnapshot as Prisma.InputJsonValue,
          rulesVersion: triage.inputSnapshot.rulesVersion,
        },
      });

      if (photos.length > 0) {
        await tx.complaintImage.createMany({
          data: photos.map((photo) => ({
            complaintId: createdComplaint.id,
            storageKey: photo.storageKey,
            originalFilename: photo.originalFilename,
            mimeType: photo.mimeType,
            sizeBytes: photo.sizeBytes,
          })),
        });
      }

      await writeComplaintAudit(tx, {
        actorId: req.user!.userId,
        complaintId: createdComplaint.id,
        action: "COMPLAINT_CREATED",
        details: {
          status: createdComplaint.status,
          source: "CITIZEN_API",
          photoCount: photos.length,
          triageUrgency: savedTriage.urgency,
          triageActionability: savedTriage.actionability,
          triageRulesVersion: savedTriage.rulesVersion,
        },
      });

      return tx.complaint.findUniqueOrThrow({
        where: {
          id: createdComplaint.id,
        },
        include: {
          images: true,
          triages: { orderBy: { assessedAt: "desc" }, take: 1 },
        },
      });
    });

    return res.status(201).json({
      message: "Complaint submitted successfully",
      complaint: {
        ...complaint,
        referenceId: formatComplaintReference(
          complaint.id,
          complaint.createdAt
        ),
        images: complaint.images.map((image) => ({
          ...image,
          url: getImageUrl(image.storageKey),
        })),
      },
    });
  } catch (error) {
    // Clean up files if the database transaction fails.
    await Promise.all(
      writtenFiles.map((filePath) =>
        unlink(filePath).catch(() => undefined)
      )
    );

    console.error("Create complaint error:", error);

    return res.status(500).json({
      message: "Failed to submit complaint",
    });
  }
};

// Retrieve complaints belonging to the logged-in citizen,
// including their supporting image metadata and URLs.
export const getMyComplaints = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const complaints = await prisma.complaint.findMany({
      where: {
        citizenId: req.user.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        images: true,
      },
    });

    const complaintsWithImages = complaints.map((complaint) => ({
      ...complaint,
      referenceId: formatComplaintReference(
        complaint.id,
        complaint.createdAt
      ),
      images: complaint.images.map((image) => ({
        ...image,
        url: getImageUrl(image.storageKey),
      })),
    }));

    return res.status(200).json({
      message: "Complaints retrieved successfully",
      count: complaintsWithImages.length,
      complaints: complaintsWithImages,
    });
  } catch (error) {
    console.error("Get complaints error:", error);

    return res.status(500).json({
      message: "Failed to retrieve complaints",
    });
  }
};

// Retrieve the complaint queue for authorized food safety officers.
export const getOfficerComplaintQueue = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (req.user.role !== "FOOD_SAFETY_OFFICER") {
      return res.status(403).json({
        message: "Only food safety officers can access this queue",
      });
    }

    const complaints = await prisma.complaint.findMany({
      orderBy: [
        { createdAt: "asc" },
        { id: "asc" },
      ],
      include: {
        riskAssessments: {
          orderBy: { assessedAt: "desc" },
          take: 1,
        },
        triages: {
          orderBy: { assessedAt: "desc" },
          take: 1,
        },
      },
    });

    const queue = complaints.map((complaint) => {
      const { riskAssessments, triages, ...complaintData } = complaint;
      const latestAssessment = riskAssessments[0] ?? null;
      const latestTriage = triages[0] ?? null;

      let priority:
        | "HIGH_REVIEW"
        | "MEDIUM_REVIEW"
        | "LOW_REVIEW"
        | "ASSESSMENT_PENDING";

      if (latestAssessment?.riskLevel === "HIGH") {
        priority = "HIGH_REVIEW";
      } else if (latestAssessment?.riskLevel === "MEDIUM") {
        priority = "MEDIUM_REVIEW";
      } else if (latestAssessment?.riskLevel === "LOW") {
        priority = "LOW_REVIEW";
      } else {
        priority = "ASSESSMENT_PENDING";
      }

      const triagePriority =
        latestTriage?.urgency === "URGENT" ? "URGENT_REVIEW" :
        latestTriage?.urgency === "HIGH" ? "HIGH_REVIEW" :
        latestTriage?.actionability === "NEEDS_INFORMATION" ? "INFORMATION_NEEDED" :
        latestTriage ? "NORMAL_REVIEW" : "TRIAGE_PENDING";

      return {
        ...complaintData,
        referenceId: formatComplaintReference(
          complaintData.id,
          complaintData.createdAt
        ),
        latestAssessment,
        latestTriage,
        priority,
        triagePriority,
      };
    });

    const triagePriorityOrder: Record<string, number> = {
      URGENT_REVIEW: 1,
      HIGH_REVIEW: 2,
      NORMAL_REVIEW: 3,
      INFORMATION_NEEDED: 4,
      TRIAGE_PENDING: 5,
    };

    const priorityOrder: Record<string, number> = {
      HIGH_REVIEW: 1,
      MEDIUM_REVIEW: 2,
      LOW_REVIEW: 3,
      ASSESSMENT_PENDING: 4,
    };

    queue.sort((a, b) => {
      const triageDifference =
        triagePriorityOrder[a.triagePriority] -
        triagePriorityOrder[b.triagePriority];

      if (triageDifference !== 0) {
        return triageDifference;
      }

      const priorityDifference =
        priorityOrder[a.priority] - priorityOrder[b.priority];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (
        new Date(a.incidentDate).getTime() -
        new Date(b.incidentDate).getTime()
      );
    });
    return res.status(200).json({
      message: "Officer complaint queue retrieved successfully",
      count: queue.length,
      note:
        "Queue ordering uses rule-based complaint triage first, followed by experimental ML assessment priority. " +
        "Triage reflects reported signals, not verified findings. ML predictions are advisory only. " +
        "Neither result authorizes enforcement; human review is required.",
      complaints: queue,
    });
  } catch (error) {
    console.error("Get officer complaint queue error:", error);

    return res.status(500).json({
      message: "Failed to retrieve officer complaint queue",
    });
  }
};

// Mark a submitted complaint as under review.
// The status update and audit entry are committed together.
export const markComplaintUnderReview = async (
  req: AuthRequest,
  res: Response
) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  if (req.user.role !== "FOOD_SAFETY_OFFICER") {
    return res.status(403).json({
      message: "Only food safety officers can review complaints",
    });
  }

  const complaintId = Number(req.params.id);

  if (!Number.isSafeInteger(complaintId) || complaintId <= 0) {
    return res.status(400).json({
      message: "A valid complaint ID is required",
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const update = await tx.complaint.updateMany({
        where: {
          id: complaintId,
          status: "SUBMITTED",
        },
        data: {
          status: "UNDER_REVIEW",
        },
      });

      if (update.count === 0) {
        const existing = await tx.complaint.findUnique({
          where: { id: complaintId },
          select: { id: true, status: true },
        });

        return {
          updated: false as const,
          existing,
        };
      }

      await writeComplaintAudit(tx, {
        actorId: req.user!.userId,
        complaintId,
        action: "COMPLAINT_MARKED_UNDER_REVIEW",
        details: {
          fromStatus: "SUBMITTED",
          toStatus: "UNDER_REVIEW",
          source: "OFFICER_API",
        },
      });

      const complaint = await tx.complaint.findUniqueOrThrow({
        where: { id: complaintId },
      });

      return {
        updated: true as const,
        complaint,
      };
    });

    if (!result.updated) {
      if (!result.existing) {
        return res.status(404).json({
          message: "Complaint not found",
        });
      }

      return res.status(409).json({
        message:
          "Complaint cannot be marked under review because its status is no longer SUBMITTED",
        currentStatus: result.existing.status,
      });
    }

    return res.status(200).json({
      message: "Complaint marked under review successfully",
      complaint: result.complaint,
    });
  } catch (error) {
    console.error("Mark complaint under review error:", error);

    return res.status(500).json({
      message: "Failed to update complaint status",
    });
  }
};

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

// List registered establishment identities.
// A registry entry does not mean its licence has been verified.
export const getOfficerEstablishments = async (
  req: AuthRequest,
  res: Response
) => {
  if (!req.user || req.user.role !== "FOOD_SAFETY_OFFICER") {
    return res.status(req.user ? 403 : 401).json({
      message: "Only authenticated food safety officers can access this registry",
    });
  }

  try {
    const establishments = await prisma.establishment.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: {
        _count: {
          select: { complaints: true },
        },
      },
    });

    return res.status(200).json({
      count: establishments.length,
      note: "Registry entries are not proof of official licence verification.",
      establishments,
    });
  } catch (error) {
    console.error("List establishments error:", error);
    return res.status(500).json({
      message: "Failed to retrieve establishments",
    });
  }
};

// Register an establishment identity.
// Do not silently link existing complaints by name.
export const createOfficerEstablishment = async (
  req: AuthRequest,
  res: Response
) => {
  if (!req.user || req.user.role !== "FOOD_SAFETY_OFFICER") {
    return res.status(req.user ? 403 : 401).json({
      message: "Only authenticated food safety officers can register establishments",
    });
  }

  const name = normalizeText(req.body?.name);
  const establishmentType = normalizeText(req.body?.establishmentType);
  const address = normalizeText(req.body?.address);
  const district = normalizeText(req.body?.district);
  const rawLicense = normalizeText(req.body?.licenseNumber);
  const licenseNumber = rawLicense || null;

  if (!name || !establishmentType || !address) {
    return res.status(400).json({
      message: "Name, establishment type, and address are required",
    });
  }

  if (
    name.length > 200 ||
    establishmentType.length > 100 ||
    address.length > 500 ||
    (district && district.length > 100) ||
    (licenseNumber && licenseNumber.length > 100)
  ) {
    return res.status(400).json({
      message: "One or more establishment fields exceed the allowed length",
    });
  }

  try {
    const establishment = await prisma.$transaction(async (tx) => {
      const created = await tx.establishment.create({
        data: {
          name,
          establishmentType,
          address,
          district,
          licenseNumber,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: req.user!.userId,
          action: "ESTABLISHMENT_REGISTERED",
          entityType: "ESTABLISHMENT",
          entityId: String(created.id),
          details: {
            source: "OFFICER_API",
            licenceVerificationStatus: "NOT_ESTABLISHED",
          },
        },
      });

      return created;
    });

    return res.status(201).json({
      message: "Establishment identity registered",
      note: "Registration does not verify the establishment's licence or food-safety compliance.",
      establishment,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        message: "That licence number is already registered",
      });
    }

    console.error("Register establishment error:", error);
    return res.status(500).json({
      message: "Failed to register establishment",
    });
  }
};

// Explicitly link a complaint to an establishment selected by an officer.
export const linkComplaintEstablishment = async (
  req: AuthRequest,
  res: Response
) => {
  if (!req.user || req.user.role !== "FOOD_SAFETY_OFFICER") {
    return res.status(req.user ? 403 : 401).json({
      message: "Only authenticated food safety officers can link complaints",
    });
  }

  const complaintId = Number(req.params.id);
  const establishmentId = req.body?.establishmentId;

  if (!Number.isSafeInteger(complaintId) || complaintId <= 0) {
    return res.status(400).json({ message: "Invalid complaint ID" });
  }

  if (
    !Number.isSafeInteger(establishmentId) ||
    establishmentId <= 0
  ) {
    return res.status(400).json({
      message: "A valid establishmentId is required",
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const complaint = await tx.complaint.findUnique({
        where: { id: complaintId },
        select: {
          id: true,
          establishmentId: true,
        },
      });

      if (!complaint) {
        return { kind: "NOT_FOUND" as const };
      }

      const establishment = await tx.establishment.findUnique({
        where: { id: establishmentId },
        select: { id: true, name: true },
      });

      if (!establishment) {
        return { kind: "ESTABLISHMENT_NOT_FOUND" as const };
      }

      if (complaint.establishmentId === establishmentId) {
        return {
          kind: "ALREADY_LINKED" as const,
          establishment,
        };
      }

      // Do not silently replace a previous identity resolution.
      if (complaint.establishmentId !== null) {
        return {
          kind: "CONFLICT" as const,
          currentEstablishmentId: complaint.establishmentId,
        };
      }

      const updated = await tx.complaint.update({
        where: { id: complaintId },
        data: { establishmentId },
        select: {
          id: true,
          establishmentId: true,
          establishmentName: true,
          location: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: req.user!.userId,
          complaintId,
          action: "COMPLAINT_ESTABLISHMENT_LINKED",
          entityType: "COMPLAINT",
          entityId: String(complaintId),
          details: {
            source: "OFFICER_API",
            establishmentId,
            establishmentName: establishment.name,
            previousEstablishmentId: complaint.establishmentId,
          },
        },
      });

      return { kind: "LINKED" as const, complaint: updated };
    });

    if (result.kind === "NOT_FOUND") {
      return res.status(404).json({ message: "Complaint not found" });
    }

    if (result.kind === "ESTABLISHMENT_NOT_FOUND") {
      return res.status(404).json({ message: "Establishment not found" });
    }

    if (result.kind === "CONFLICT") {
      return res.status(409).json({
        message: "This complaint is already linked. Resolve the existing link explicitly before changing it.",
        currentEstablishmentId: result.currentEstablishmentId,
      });
    }

    if (result.kind === "ALREADY_LINKED") {
      return res.status(200).json({
        message: "Complaint is already linked to this establishment",
        establishment: result.establishment,
      });
    }

    return res.status(200).json({
      message: "Complaint linked successfully",
      complaint: result.complaint,
    });
  } catch (error) {
    console.error("Link complaint establishment error:", error);
    return res.status(500).json({
      message: "Failed to link complaint",
    });
  }
};

// Return complaint counts and verified establishment records separately.
// A complaint is an allegation/report, not automatically a verified violation.
export const getEstablishmentHistory = async (
  req: AuthRequest,
  res: Response
) => {
  if (!req.user || req.user.role !== "FOOD_SAFETY_OFFICER") {
    return res.status(req.user ? 403 : 401).json({
      message: "Only authenticated food safety officers can view establishment history",
    });
  }

  const establishmentId = Number(req.params.establishmentId);

  if (!Number.isSafeInteger(establishmentId) || establishmentId <= 0) {
    return res.status(400).json({
      message: "Invalid establishment ID",
    });
  }

  try {
    const establishment = await prisma.establishment.findUnique({
      where: { id: establishmentId },
      include: {
        complaints: {
          select: {
            id: true,
            title: true,
            status: true,
            incidentDate: true,
            createdAt: true,
            establishmentName: true,
          },
          orderBy: { createdAt: "desc" },
        },
        records: {
          where: { verified: true },
          select: {
            id: true,
            recordType: true,
            description: true,
            sourceType: true,
            sourceReference: true,
            occurredAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!establishment) {
      return res.status(404).json({
        message: "Establishment not found",
      });
    }

    return res.status(200).json({
      establishment: {
        id: establishment.id,
        name: establishment.name,
        establishmentType: establishment.establishmentType,
        address: establishment.address,
        district: establishment.district,
        licenseNumber: establishment.licenseNumber,
        licenceVerificationStatus: "NOT_ESTABLISHED_BY_REGISTRY_ENTRY",
      },
      previousComplaintCount: establishment.complaints.length,
      previousComplaints: establishment.complaints,
      verifiedRecordCount: establishment.records.length,
      verifiedRecords: establishment.records,
      note: "Complaint history contains reports and allegations. Verified records are shown separately; neither count alone establishes current risk.",
    });
  } catch (error) {
    console.error("Get establishment history error:", error);
    return res.status(500).json({
      message: "Failed to retrieve establishment history",
    });
  }
};
