
import { Router } from "express";

import { predictRisk } from "../controllers/aiController";
import { getComplaintFeatures } from "../controllers/complaintFeatureController";

import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/authMiddleware";

const router = Router();

// Existing experimental inspection-risk prediction endpoint.
router.post(
  "/predict",
  authenticateToken,
  predictRisk
);

// Read-only complaint-stage feature extraction.
// This endpoint does not generate an ML prediction.
router.get(
  "/complaints/:id/features",
  authenticateToken,
  authorizeRoles("FOOD_SAFETY_OFFICER"),
  getComplaintFeatures
);

export default router;
