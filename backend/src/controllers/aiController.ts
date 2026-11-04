
import { Request, Response } from "express";

interface AuthRequest extends Request {
  user?: {
    userId: number;
    role: string;
  };
}

/**
 * Experimental ML prediction is intentionally unavailable through
 * the complaint API until all model inputs have verified provenance.
 *
 * The existing Random Forest expects establishment and inspection
 * measurements. Complaint submissions and caller-supplied values
 * cannot establish those measurements.
 *
 * This endpoint must not create RiskAssessment records from
 * unverified or user-supplied inspection data.
 */
export const predictRisk = async (
  req: AuthRequest,
  res: Response
) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  if (
    req.user.role !== "CITIZEN" &&
    req.user.role !== "FOOD_SAFETY_OFFICER"
  ) {
    return res.status(403).json({
      message: "This role cannot request complaint risk predictions",
    });
  }

  return res.status(409).json({
    message:
      "Experimental ML prediction is unavailable for complaint-stage data.",
    code: "VERIFIED_INSPECTION_INPUTS_REQUIRED",
    predictionGenerated: false,
    assessmentCreated: false,
    advisoryOnly: true,
    realWorldValidated: false,
    reason:
      "The model requires establishment and inspection measurements with documented provenance. Complaint allegations and caller-supplied feature values are not accepted as verified inspection evidence.",
    requiredConditions: [
      "Verified establishment identity",
      "Structured inspection measurements",
      "Documented source and verification status for each input",
      "A traceable inspection evidence record",
    ],
    alternative:
      "The existing rule-based provisional complaint assessment remains available and requires human review.",
  });
};
