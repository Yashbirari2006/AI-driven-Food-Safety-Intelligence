
import { Router } from "express";

import {
  createComplaint,
  getMyComplaints,
  getOfficerComplaintQueue,
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

export default router;
