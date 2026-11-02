
import { Request, Response } from "express";
import { extractComplaintFeatures } from "../services/complaintFeatureService";

interface AuthRequest extends Request {
  user?: {
    userId: number;
    role: string;
  };
}

/**
 * Read-only complaint feature extraction endpoint.
 * Accessible only to authenticated food safety officers through aiRoutes.
 */
export const getComplaintFeatures = async (
  req: AuthRequest,
  res: Response
) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const complaintId = Number(req.params.id);

  if (!Number.isSafeInteger(complaintId) || complaintId <= 0) {
    return res.status(400).json({
      message: "A valid complaint ID is required",
    });
  }

  try {
    const features = await extractComplaintFeatures(complaintId);

    return res.status(200).json({
      message: "Complaint features extracted successfully",
      advisoryOnly: true,
      predictionGenerated: false,
      features,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Complaint not found."
    ) {
      return res.status(404).json({
        message: "Complaint not found",
      });
    }

    if (
      error instanceof Error &&
      error.message === "A valid complaint ID is required."
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    console.error("Complaint feature extraction error:", error);

    return res.status(500).json({
      message: "Failed to extract complaint features",
    });
  }
};
