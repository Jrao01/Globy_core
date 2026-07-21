import { Router } from "express";
import { SearchCompetitors, GetSearchHistory, GetCompetitors } from "../controllers/CompetitorControllers.js";
import { verifyToken, verifyRole } from "../middleware/authMiddleware.js";
import { scrapingLimiter } from "../middleware/rateLimit.js";
import { validate, schemas } from "../middleware/validate.js";

const router = Router();

router.post("/search", verifyToken, verifyRole("admin", "gerente"), scrapingLimiter, validate(schemas.competitorSearch), SearchCompetitors);
router.get("/history", verifyToken, verifyRole("admin", "gerente", "trabajador"), GetSearchHistory);
router.get("/all", verifyToken, verifyRole("admin", "gerente", "trabajador"), GetCompetitors);

export default router;
