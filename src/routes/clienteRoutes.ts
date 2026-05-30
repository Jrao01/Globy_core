import { Router } from "express";
import { ClienteRegister, ClienteLogin, GetCLienteData, UpdateCliente } from "../controllers/ClienteControllers.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/register", ClienteRegister);
router.post("/login", ClienteLogin);

// Rutas protegidas
router.post("/data", verifyToken, GetCLienteData);
router.put("/update", verifyToken, UpdateCliente);

export default router;
