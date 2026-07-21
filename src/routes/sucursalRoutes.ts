import { Router } from "express";
import { CreateSucursal, GetAllSucursales, GetSucursalById, UpdateSucursal, EnableSucursal, DisableSucursal } from "../controllers/SucursalControllers.js";
import { verifyToken, verifyRole } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/create", verifyToken, verifyRole("admin"), CreateSucursal);
router.get("/all", verifyToken, GetAllSucursales);
router.post("/data", verifyToken, GetSucursalById);
router.put("/update", verifyToken, verifyRole("admin"), UpdateSucursal);
router.patch<{ id: string }>("/:id/enable", verifyToken, verifyRole("admin"), EnableSucursal);
router.patch<{ id: string }>("/:id/disable", verifyToken, verifyRole("admin"), DisableSucursal);

export default router;
