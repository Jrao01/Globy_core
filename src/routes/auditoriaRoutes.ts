import { Router } from "express";
import { verifyToken, verifyRole } from "../middleware/authMiddleware.js";
import { ListarAuditoria } from "../controllers/AuditoriaControllers.js";

const router = Router();

router.get("/", verifyToken, verifyRole("admin"), ListarAuditoria);

export default router;
