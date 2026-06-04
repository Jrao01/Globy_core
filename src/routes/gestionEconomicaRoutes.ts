import { Router } from "express";
import { GetConfig, UpdateConfig } from "../controllers/GestionEconomicaControllers.js";

const router = Router();

router.get("/", GetConfig);
router.put("/", UpdateConfig);

export default router;
