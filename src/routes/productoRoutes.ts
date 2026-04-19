import { Router } from "express";
import { CreateProducto, GetAllProductos, UpdateProducto, GetProductoById } from "../controllers/ProductoControllers.js";

const router = Router();

router.post("/create", CreateProducto);
router.get("/all", GetAllProductos);
router.post("/data", GetProductoById);
router.put("/update", UpdateProducto);

export default router;
