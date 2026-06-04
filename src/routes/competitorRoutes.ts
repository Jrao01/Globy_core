import { Router } from "express";
import { SearchCompetitors, GetSearchHistory, GetCompetitors } from "../controllers/CompetitorControllers.js";

const router = Router();

router.post("/search", SearchCompetitors);
router.get("/history", GetSearchHistory);
router.get("/all", GetCompetitors);

export default router;
