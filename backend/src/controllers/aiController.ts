
import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { Prisma } from "@prisma/client";

const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";

interface AuthRequest extends Request {
  user?: { userId: number; role: string };
}

const expectedFeatures = [
  "district",
  "area_type",
  "establishment_type",
  "hygiene_score",
  "temperature_control_deviation",
  "unsafe_water_indicator",
  "pest_signs",
  "cross_contamination_indicator",
  "expired_food_indicator",
  "complaints_30d",
  "illness_reports_7d",
  "days_since_last_inspection",
  "license_status",
] as const;

type PredictionResponse = {
  predicted_risk: unknown;
  class_probabilities: unknown;
  model_type?: unknown;
  data_status?: unknown;
  real_world_validated?: unknown;
  advisory_only: true;
  message?: unknown;
};

export const predictRisk = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const { complaintId, features } = req.body ?? {};

  if (
    !Number.isSafeInteger(complaintId) ||
    complaintId <= 0 ||
    !features ||
    typeof features !== "object" ||
    Array.isArray(features)
  ) {
    return res.status(400).json({
      message: "A positive complaintId and a features object are required",
    });
  }

  const suppliedKeys = Object.keys(features);

  if (
    suppliedKeys.length !== expectedFeatures.length ||
    !expectedFeatures.every((key) => suppliedKeys.includes(key))
  ) {
    return res.status(400).json({
      message: "Provide exactly the 13 expected ML features",
      expectedFeatures,
    });
  }

  try {
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: { id: true, citizenId: true },
    });

    if (!complaint) {
      return res.status(404).json({
        message: "Complaint not found",
      });
    }

    // Citizens can assess only their own complaints.
    // Officers can request assessments for human review.
    if (
      req.user.role === "CITIZEN" &&
      complaint.citizenId !== req.user.userId
    ) {
      return res.status(403).json({
        message: "You are not authorized to assess this complaint",
      });
    }

    if (
      req.user.role !== "CITIZEN" &&
      req.user.role !== "FOOD_SAFETY_OFFICER"
    ) {
      return res.status(403).json({
        message: "This role cannot request risk assessments",
      });
    }

    const mlResponse = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(features),
      signal: AbortSignal.timeout(5000),
    });

    const result: unknown = await mlResponse.json().catch(() => null);

    if (!mlResponse.ok) {
      if (mlResponse.status === 422) {
        return res.status(422).json({
          message: "Invalid prediction input",
          details: result,
        });
      }

      return res.status(502).json({
        message: "The ML service could not process the prediction",
      });
    }

    if (
      !result ||
      typeof result !== "object" ||
      !("predicted_risk" in result) ||
      !("class_probabilities" in result) ||
      !("advisory_only" in result) ||
      result.advisory_only !== true
    ) {
      return res.status(502).json({
        message: "The ML service returned an unexpected response",
      });
    }

    const prediction = result as PredictionResponse;

    // Never treat a prediction as validated real-world evidence.
    if (
      typeof prediction.predicted_risk !== "string" ||
      !["Low", "Medium", "High"].includes(prediction.predicted_risk) ||
      prediction.real_world_validated !== false
    ) {
      return res.status(502).json({
        message: "The prediction response failed safety checks",
      });
    }

    if (
      typeof prediction.data_status !== "string" ||
      typeof prediction.model_type !== "string" ||
      !prediction.class_probabilities ||
      typeof prediction.class_probabilities !== "object" ||
      Array.isArray(prediction.class_probabilities)
    ) {
      return res.status(502).json({
        message: "The ML service returned invalid prediction metadata",
      });
    }

    const probabilities = prediction.class_probabilities as Record<
      string,
      unknown
    >;

    const validProbabilities = ["Low", "Medium", "High"].every((level) => {
      const value = probabilities[level];

      return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 1
      );
    });

    if (!validProbabilities) {
      return res.status(502).json({
        message: "The ML service returned invalid class probabilities",
      });
    }

    // Convert validated JSON-compatible values for Prisma.
    const safeProbabilities: Prisma.InputJsonObject = {
      Low: probabilities.Low as number,
      Medium: probabilities.Medium as number,
      High: probabilities.High as number,
    };
    const probabilityTotal =
  (probabilities.Low as number) +
  (probabilities.Medium as number) +
  (probabilities.High as number);

if (Math.abs(probabilityTotal - 1) > 0.01) {
  return res.status(502).json({
    message: "The ML service returned probabilities that do not sum to 1",
  });
}

// Experimental model-derived risk index (0–100).
const riskScore = Number(
  (
    100 *
    ((probabilities.High as number) +
      0.5 * (probabilities.Medium as number))
  ).toFixed(2),
);
    const safeFeatures = features as Prisma.InputJsonObject;

    const riskLevel = prediction.predicted_risk.toUpperCase() as
      | "LOW"
      | "MEDIUM"
      | "HIGH";

    const assessment = await prisma.riskAssessment.create({
      data: {
        complaintId,
        riskScore,
        riskLevel,
        status: "PROVISIONAL",
        evidenceQuality: "INSUFFICIENT",
        humanReviewRequired: true,

        contributingFactors: {
          classProbabilities: safeProbabilities,
        },

        evidenceSnapshot: {
          features: safeFeatures,
          featureSource: "user_supplied_experimental_input",
          dataStatus: prediction.data_status,
          realWorldValidated: false,
          advisoryOnly: true,
        },

        modelVersions: {
          modelType: prediction.model_type,
          dataStatus: prediction.data_status,
        },
      },
    });

    return res.status(201).json({
      message:
        "Provisional advisory assessment saved; human review is required",

      assessment,

      prediction: {
        predictedRisk: prediction.predicted_risk,
        riskScore,
        riskScoreType: "experimental_model_derived_index",
        classProbabilities: safeProbabilities,
        advisoryOnly: true,
        realWorldValidated: false,
        note:
          typeof prediction.message === "string"
            ? prediction.message
            : null,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return res.status(504).json({
        message: "The ML prediction service timed out",
      });
    }

    if (error instanceof Error && error.name === "AbortError") {
      return res.status(503).json({
        message: "The ML prediction request was interrupted",
      });
    }

    console.error("Risk assessment error:", error);

    return res.status(500).json({
      message: "Risk assessment could not be completed",
    });
  }
};
