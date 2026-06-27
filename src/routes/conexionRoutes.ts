import { Router } from "express";
import { RegistrarConexion, ObtenerTodasConexiones } from "../controllers/ConexionControllers.js";
import { verifyToken, verifyRole } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/register", verifyToken, RegistrarConexion);
router.get("/all", verifyToken, verifyRole("admin", "gerente", "trabajador"), ObtenerTodasConexiones);

export default router;
