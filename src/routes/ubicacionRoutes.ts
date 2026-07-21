import { Router } from "express";
import { UpdateUbicacion, GetUbicacion, GetHistorialUbicacion } from "../controllers/UbicacionController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/:compraId/ubicacion", verifyToken, UpdateUbicacion);
router.get("/:compraId/ubicacion", verifyToken, GetUbicacion);
router.get("/:compraId/historial", verifyToken, GetHistorialUbicacion);

export default router;