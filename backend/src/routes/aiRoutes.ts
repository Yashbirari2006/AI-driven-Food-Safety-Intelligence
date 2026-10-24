
import { Router } from "express";
import { predictRisk } from "../controllers/aiController";
import { authenticateToken } from "../middleware/authMiddleware";

const router = Router();

router.post("/predict", authenticateToken, predictRisk);

export default router;
