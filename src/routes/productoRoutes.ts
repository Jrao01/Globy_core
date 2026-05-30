import { Router } from "express";
import { 
    CreateProducto, 
    GetAllProductos, 
    GetProductoById, 
    UpdateProducto,
    GetCategorias,
    GetInventoryBySucursal,
    UpdateStock,
    EnableProducto,
    DisableProducto
} from "../controllers/ProductoControllers.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/create", verifyToken, CreateProducto);
router.get("/all", verifyToken, GetAllProductos);
router.post("/data", verifyToken, GetProductoById);
router.put("/update", verifyToken, UpdateProducto);
router.patch<{ id: string }>("/:id/enable", verifyToken, EnableProducto);
router.patch<{ id: string }>("/:id/disable", verifyToken, DisableProducto);

router.get<{ sucursalId: string }>("/inventory/:sucursalId", verifyToken, GetInventoryBySucursal);
router.get("/categorias", verifyToken, GetCategorias);
router.post("/inventory/update", verifyToken, UpdateStock);

export default router;
