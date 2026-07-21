import { Router } from "express";
import {
  CreateCategoria,
  GetAllCategorias,
  UpdateCategoria,
  DeleteCategoria,
} from "../controllers/CategoriaControllers.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/create", verifyToken, CreateCategoria);
router.get("/all", verifyToken, GetAllCategorias);
router.put("/update", verifyToken, UpdateCategoria);
router.delete<{ id: string }>("/:id", verifyToken, DeleteCategoria);

export default router;
