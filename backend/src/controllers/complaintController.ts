
import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

import prisma from "../lib/prisma";
import { writeComplaintAudit } from "../utils/auditLog";

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
        },
      });

      return tx.complaint.findUniqueOrThrow({
        where: {
          id: createdComplaint.id,
        },
        include: {
          images: true,
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
          orderBy: {
            assessedAt: "desc",
          },
          take: 1,
        },
      },
    });

    const queue = complaints.map((complaint) => {
      const { riskAssessments, ...complaintData } = complaint;
      const latestAssessment = riskAssessments[0] ?? null;

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

      return {
        ...complaintData,
        referenceId: formatComplaintReference(
          complaintData.id,
          complaintData.createdAt
        ),
        latestAssessment,
        priority,
      };
    });

    const priorityOrder: Record<string, number> = {
      HIGH_REVIEW: 1,
      MEDIUM_REVIEW: 2,
      LOW_REVIEW: 3,
      ASSESSMENT_PENDING: 4,
    };

    queue.sort((a, b) => {
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
        "Priority is based on the latest recorded risk level. " +
        "Predictions are advisory only and do not authorize enforcement. " +
        "Complaints require appropriate human review.",
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
