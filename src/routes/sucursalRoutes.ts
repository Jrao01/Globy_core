import { Router } from "express";
import { CreateSucursal, GetAllSucursales, UpdateSucursal, GetSucursalById } from "../controllers/SucursalControllers.js";

const router = Router();

router.post("/create", CreateSucursal);
router.get("/all", GetAllSucursales);
router.post("/data", GetSucursalById);
router.put("/update", UpdateSucursal);

export default router;
