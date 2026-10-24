
import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { writeComplaintAudit } from "../utils/auditLog";

interface AuthRequest extends Request {
  user?: {
    userId: number;
    role: string;
  };
}

// Submit a complaint
export const createComplaint = async (
  req: AuthRequest,
  res: Response
) => {
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

    const parsedIncidentDate = new Date(incidentDate);

    if (Number.isNaN(parsedIncidentDate.getTime())) {
      return res.status(400).json({
        message: "A valid incidentDate is required",
      });
    }

    const complaint = await prisma.$transaction(async (tx) => {
  const createdComplaint = await tx.complaint.create({
    data: {
      citizenId: req.user!.userId,
      title,
      description,
      foodType,
      establishmentName,
      location,
      incidentDate: parsedIncidentDate,
    },
  });

  await writeComplaintAudit(tx, {
    actorId: req.user!.userId,
    complaintId: createdComplaint.id,
    action: "COMPLAINT_CREATED",
    details: {
      status: createdComplaint.status,
      source: "CITIZEN_API",
    },
  });

  return createdComplaint;
});

    return res.status(201).json({
      message: "Complaint submitted successfully",
      complaint,
    });
  } catch (error) {
    console.error("Create complaint error:", error);

    return res.status(500).json({
      message: "Failed to submit complaint",
    });
  }
};

// Retrieve complaints submitted by the logged-in citizen
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
    });

    return res.status(200).json({
      message: "Complaints retrieved successfully",
      count: complaints.length,
      complaints,
    });
  } catch (error) {
    console.error("Get complaints error:", error);

    return res.status(500).json({
      message: "Failed to retrieve complaints",
    });
  }
};

// Retrieve the complaint queue for authorized food safety officers
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

    // Additional role check, alongside route middleware
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
