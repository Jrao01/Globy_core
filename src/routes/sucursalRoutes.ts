import { Router } from "express";
import { CreateSucursal, GetAllSucursales, GetSucursalById, UpdateSucursal } from "../controllers/SucursalControllers.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/create", verifyToken, CreateSucursal);
router.get("/all", verifyToken, GetAllSucursales);
router.post("/data", verifyToken, GetSucursalById);
router.put("/update", verifyToken, UpdateSucursal);

export default router;
