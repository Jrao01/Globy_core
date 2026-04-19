import { Router } from "express";
import { PersonalRegister, PersonalLogin, UpdatePersonal, GetPersonalById } from "../controllers/PersonalControllers.js";

const router = Router();

router.post("/register", PersonalRegister);
router.post("/login", PersonalLogin);
router.post("/data", GetPersonalById);
router.put("/update", UpdatePersonal);

export default router;
