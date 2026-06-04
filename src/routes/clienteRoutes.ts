import { Router } from "express";
import { ClienteRegister, ClienteLogin, GetCLienteData, GetAllClientes, SearchClienteByCedula, UpdateCliente } from "../controllers/ClienteControllers.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/register", ClienteRegister);
router.post("/login", ClienteLogin);
router.get("/search/:cedula", SearchClienteByCedula);

// Rutas protegidas
router.post("/data", verifyToken, GetCLienteData);
router.put("/update", verifyToken, UpdateCliente);
router.get("/all", verifyToken, GetAllClientes);

export default router;
