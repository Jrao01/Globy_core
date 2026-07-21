import { Router } from "express";
import { ClienteRegister, ClienteLogin, GoogleAuth, GetCLienteData, GetAllClientes, SearchClienteByCedula, UpdateCliente, ChangeClientePassword, GetClienteStats, GetClienteConexiones } from "../controllers/ClienteControllers.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { validate, schemas } from "../middleware/validate.js";

const router = Router();

router.post("/register", validate(schemas.clienteRegister), ClienteRegister);
router.post("/login", authLimiter, validate(schemas.clienteLogin), ClienteLogin);
router.post("/google", authLimiter, GoogleAuth);
router.get("/search/:cedula", SearchClienteByCedula);

// Rutas protegidas
router.post("/data", verifyToken, GetCLienteData);
router.put("/update", verifyToken, UpdateCliente);
router.put("/change-password", verifyToken, ChangeClientePassword);
router.get("/all", verifyToken, GetAllClientes);
router.get("/:clienteId/stats", verifyToken, GetClienteStats);
router.get("/:clienteId/conexiones", verifyToken, GetClienteConexiones);

export default router;
