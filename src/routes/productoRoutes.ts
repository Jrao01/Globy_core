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
    DisableProducto,
    GetProductoDetail
} from "../controllers/ProductoControllers.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/uploadMiddleware.js";

const router = Router();

router.post("/upload-image", verifyToken, upload.single("imagen"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "No se envió ninguna imagen" });
    return;
  }
  const imageUrl = `uploads/${req.file.filename}`;
  res.json({ message: "Imagen subida", data: { url: imageUrl } });
});

router.post("/create", verifyToken, CreateProducto);
router.get("/all", verifyToken, GetAllProductos);
router.get("/detail/:id", verifyToken, GetProductoDetail);
router.post("/data", verifyToken, GetProductoById);
router.put("/update", verifyToken, UpdateProducto);
router.patch<{ id: string }>("/:id/enable", verifyToken, EnableProducto);
router.patch<{ id: string }>("/:id/disable", verifyToken, DisableProducto);

router.get<{ sucursalId: string }>("/inventory/:sucursalId", verifyToken, GetInventoryBySucursal);
router.get("/categorias", verifyToken, GetCategorias);
router.post("/inventory/update", verifyToken, UpdateStock);

export default router;
