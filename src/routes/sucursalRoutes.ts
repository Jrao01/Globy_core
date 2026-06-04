import { Router } from "express";
import { CreateSucursal, GetAllSucursales, GetSucursalById, UpdateSucursal, EnableSucursal, DisableSucursal } from "../controllers/SucursalControllers.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/create", verifyToken, CreateSucursal);
router.get("/all", verifyToken, GetAllSucursales);
router.post("/data", verifyToken, GetSucursalById);
router.put("/update", verifyToken, UpdateSucursal);
router.patch<{ id: string }>("/:id/enable", verifyToken, EnableSucursal);
router.patch<{ id: string }>("/:id/disable", verifyToken, DisableSucursal);

export default router;
