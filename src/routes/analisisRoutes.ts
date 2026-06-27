import { Router } from "express";
import {
  GenerarInformePatrones,
  GenerarInformeDemanda,
  GenerarInformeRendimiento,
  GenerarInformeSucursal,
  ListarInformes,
  GuardarPDF,
  ObtenerEstadisticas,
} from "../controllers/AnalisisControllers.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { aiLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.get("/estadisticas", verifyToken, ObtenerEstadisticas);
router.post("/patrones", verifyToken, aiLimiter, GenerarInformePatrones);
router.post("/demanda", verifyToken, aiLimiter, GenerarInformeDemanda);
router.post("/rendimiento", verifyToken, aiLimiter, GenerarInformeRendimiento);
router.post("/sucursales", verifyToken, aiLimiter, GenerarInformeSucursal);
router.post("/save-pdf", verifyToken, GuardarPDF);
router.get("/informes", verifyToken, ListarInformes);

export default router;
