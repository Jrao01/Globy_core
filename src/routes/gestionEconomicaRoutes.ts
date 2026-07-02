import { Router } from "express";
import { GetConfig, UpdateConfig, GetHistorialTasas } from "../controllers/GestionEconomicaControllers.js";

const router = Router();

router.get("/", GetConfig);
router.put("/", UpdateConfig);
router.get("/historial-tasas", GetHistorialTasas);

export default router;
