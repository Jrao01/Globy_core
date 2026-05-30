import { Router } from "express";
import { PersonalRegister, LogInPersonal, UpdatePersonal, GetPersonalById, GetAllPersonal, EnablePersonal, DisablePersonal } from "../controllers/PersonalControllers.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/register", verifyToken, PersonalRegister);
router.post("/login", LogInPersonal);

// Rutas protegidas
router.get("/all", verifyToken, GetAllPersonal);
router.put("/update", verifyToken, UpdatePersonal);
router.post("/data", verifyToken, GetPersonalById);
router.get<{ id: string }>("/:id", verifyToken, GetPersonalById);
router.patch<{ id: string }>("/:id/enable", verifyToken, EnablePersonal);
router.patch<{ id: string }>("/:id/disable", verifyToken, DisablePersonal);

export default router;
