import { Router } from "express";
import { PersonalRegister, LogInPersonal, UpdatePersonal, GetPersonalById, GetAllPersonal, EnablePersonal, DisablePersonal } from "../controllers/PersonalControllers.js";
import { verifyToken, verifyRole } from "../middleware/authMiddleware.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { validate, schemas } from "../middleware/validate.js";

const router = Router();

router.post("/register", verifyToken, verifyRole("admin"), validate(schemas.personalRegister), PersonalRegister);
router.post("/login", authLimiter, LogInPersonal);

// Rutas protegidas
router.get("/all", verifyToken, verifyRole("admin", "gerente"), GetAllPersonal);
router.put("/update", verifyToken, verifyRole("admin", "gerente"), UpdatePersonal);
router.post("/data", verifyToken, GetPersonalById);
router.get<{ id: string }>("/:id", verifyToken, GetPersonalById);
router.patch<{ id: string }>("/:id/enable", verifyToken, verifyRole("admin"), EnablePersonal);
router.patch<{ id: string }>("/:id/disable", verifyToken, verifyRole("admin"), DisablePersonal);

export default router;
