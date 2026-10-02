import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import {
  authenticateToken,
  authorizeRoles,
} from "./middleware/authMiddleware";
const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Food Safety Intelligence API is running",
  });
});

app.get("/api/protected", authenticateToken, (_req, res) => {
  res.json({
    message: "You have access to this protected route",
  });
});
app.get(
  "/api/officer-test",
  authenticateToken,
  authorizeRoles("FOOD_SAFETY_OFFICER"),
  (_req, res) => {
    res.json({
      message: "Officer access granted",
    });
  }
);
app.use("/api/auth", authRoutes);

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});