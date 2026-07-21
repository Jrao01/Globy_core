import { Router } from "express";
import {
  GenerarInformePatrones,
  GenerarInformeDemanda,
  GenerarInformeRendimiento,
  GenerarInformeSucursal,
  GenerarInformeExpansion,
  GenerarInformeEquilibrio,
  GenerarInformeCanibalizacion,
  ListarInformes,
  GuardarPDF,
  ObtenerEstadisticas,
  DashboardResumen,
} from "../controllers/AnalisisControllers.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { aiLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.get("/estadisticas", verifyToken, ObtenerEstadisticas);
router.get("/dashboard", verifyToken, DashboardResumen);
router.post("/patrones", verifyToken, aiLimiter, GenerarInformePatrones);
router.post("/demanda", verifyToken, aiLimiter, GenerarInformeDemanda);
router.post("/rendimiento", verifyToken, aiLimiter, GenerarInformeRendimiento);
router.post("/sucursales", verifyToken, aiLimiter, GenerarInformeSucursal);
router.post("/expansion", verifyToken, aiLimiter, GenerarInformeExpansion);
router.post("/equilibrio", verifyToken, aiLimiter, GenerarInformeEquilibrio);
router.post("/canibalizacion", verifyToken, aiLimiter, GenerarInformeCanibalizacion);
router.post("/save-pdf", verifyToken, GuardarPDF);
router.get("/informes", verifyToken, ListarInformes);

export default router;
