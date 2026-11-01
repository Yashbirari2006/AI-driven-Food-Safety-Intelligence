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
  createComplaintOutcomeAssessment,
  attachComplaintOutcomeEvidence,
  reviewComplaintOutcomeEvidence,
  finalizeComplaintOutcomeAssessment,
  getComplaintOutcomeHistory,
} from "../controllers/complaintOutcomeController";

import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/authMiddleware";

const router = Router();

// Citizen complaint workflow
router.post(
  "/",
  authenticateToken,
  authorizeRoles("CITIZEN"),
  createComplaint
);

router.get(
  "/my",
  authenticateToken,
  authorizeRoles("CITIZEN"),
  getMyComplaints
);

// Officer complaint workflow
router.get(
  "/officer/queue",
  authenticateToken,
  authorizeRoles("FOOD_SAFETY_OFFICER"),
  getOfficerComplaintQueue
);

router.patch(
  "/officer/:id/status",
  authenticateToken,
  authorizeRoles("FOOD_SAFETY_OFFICER"),
  markComplaintUnderReview
);

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

router.patch(
  "/officer/:id/establishment",
  authenticateToken,
  authorizeRoles("FOOD_SAFETY_OFFICER"),
  linkComplaintEstablishment
);

router.get(
  "/officer/establishments/:establishmentId/history",
  authenticateToken,
  authorizeRoles("FOOD_SAFETY_OFFICER"),
  getEstablishmentHistory
);

// Complaint outcome assessment workflow
router.post(
  "/officer/:id/outcomes",
  authenticateToken,
  authorizeRoles("FOOD_SAFETY_OFFICER", "SUPERVISOR"),
  createComplaintOutcomeAssessment
);

router.get(
  "/officer/:id/outcomes",
  authenticateToken,
  authorizeRoles("FOOD_SAFETY_OFFICER", "SUPERVISOR"),
  getComplaintOutcomeHistory
);

router.post(
  "/officer/outcomes/:assessmentId/evidence",
  authenticateToken,
  authorizeRoles("FOOD_SAFETY_OFFICER", "SUPERVISOR"),
  attachComplaintOutcomeEvidence
);

router.patch(
  "/officer/outcomes/evidence/:evidenceId/review",
  authenticateToken,
  authorizeRoles("FOOD_SAFETY_OFFICER", "SUPERVISOR"),
  reviewComplaintOutcomeEvidence
);

router.patch(
  "/officer/outcomes/:assessmentId/finalize",
  authenticateToken,
  authorizeRoles("FOOD_SAFETY_OFFICER", "SUPERVISOR"),
  finalizeComplaintOutcomeAssessment
);

export default router;