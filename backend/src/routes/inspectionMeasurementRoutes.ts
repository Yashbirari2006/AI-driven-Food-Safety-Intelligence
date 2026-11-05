
import { Router } from "express";

import {
  recordInspectionMeasurement,
  getInspectionMeasurements,
  reviewInspectionMeasurement,
  reviseInspectionMeasurement,
} from "../controllers/inspectionMeasurementController";

import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/authMiddleware";

const router = Router();

router.use(authenticateToken);

router.post(
  "/:id/measurements",
  authorizeRoles("FOOD_SAFETY_OFFICER"),
  recordInspectionMeasurement
);

router.get(
  "/:id/measurements",
  authorizeRoles("FOOD_SAFETY_OFFICER", "SUPERVISOR"),
  getInspectionMeasurements
);

router.patch(
  "/measurements/:measurementId/review",
  authorizeRoles("SUPERVISOR"),
  reviewInspectionMeasurement
);

router.post(
  "/:id/measurements/:measurementId/revisions",
  authorizeRoles("FOOD_SAFETY_OFFICER"),
  reviseInspectionMeasurement
);

export default router;
