
import { Router } from "express";

import {
  createComplaint,
  getMyComplaints,
  getOfficerComplaintQueue,
  markComplaintUnderReview,
  getOfficerEstablishments,
  createOfficerEstablishment,
  linkComplaintEstablishment,
  getEstablishmentHistory,
} from "../controllers/complaintController";

import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/authMiddleware";

const router = Router();

// Citizen: submit a complaint
router.post(
  "/",
  authenticateToken,
  authorizeRoles("CITIZEN"),
  createComplaint
);

// Citizen: view their own complaints
router.get(
  "/my",
  authenticateToken,
  authorizeRoles("CITIZEN"),
  getMyComplaints
);

// Food safety officer: view all complaints for review
router.get(
  "/officer/queue",
  authenticateToken,
  authorizeRoles("FOOD_SAFETY_OFFICER"),
  getOfficerComplaintQueue
);

// Food safety officer: mark a complaint under review
router.patch(
  "/officer/:id/status",
  authenticateToken,
  authorizeRoles("FOOD_SAFETY_OFFICER"),
  markComplaintUnderReview
);

// Officer-only establishment registry
router.get(
  "/officer/establishments",
  authenticateToken,
  authorizeRoles("FOOD_SAFETY_OFFICER"),
  getOfficerEstablishments
);

router.post(
  "/officer/establishments",
  authenticateToken,
  authorizeRoles("FOOD_SAFETY_OFFICER"),
  createOfficerEstablishment
);

// Explicitly link a complaint to an establishment
router.patch(
  "/officer/:id/establishment",
  authenticateToken,
  authorizeRoles("FOOD_SAFETY_OFFICER"),
  linkComplaintEstablishment
);

// View establishment complaint history and verified records
router.get(
  "/officer/establishments/:establishmentId/history",
  authenticateToken,
  authorizeRoles("FOOD_SAFETY_OFFICER"),
  getEstablishmentHistory
);

export default router;
