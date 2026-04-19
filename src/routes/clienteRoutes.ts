import { Router } from "express";
import { ClienteRegister, ClienteLogin, GetCLienteData, UpdateCliente } from "../controllers/ClienteControllers.js";

const router = Router();

router.post("/register", ClienteRegister);
router.post("/login", ClienteLogin);
router.post("/data", GetCLienteData); 
router.put("/update", UpdateCliente);

export default router;
