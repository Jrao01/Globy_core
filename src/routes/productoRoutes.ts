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
import { verifyToken, verifyRole } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";
import { validate, schemas } from "../middleware/validate.js";

const router = Router();

router.post("/upload-image", verifyToken, verifyRole("admin", "gerente"), upload.single("imagen"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "No se envió ninguna imagen" });
    return;
  }
  const imageUrl = `uploads/${req.file.filename}`;
  res.json({ message: "Imagen subida", data: { url: imageUrl } });
});

router.post("/create", verifyToken, verifyRole("admin", "gerente"), validate(schemas.createProducto), CreateProducto);
router.get("/all", verifyToken, GetAllProductos);
router.get<{ id: string }>("/detail/:id", verifyToken, GetProductoDetail);
router.post("/data", verifyToken, GetProductoById);
router.put("/update", verifyToken, verifyRole("admin", "gerente"), UpdateProducto);
router.patch<{ id: string }>("/:id/enable", verifyToken, verifyRole("admin", "gerente"), EnableProducto);
router.patch<{ id: string }>("/:id/disable", verifyToken, verifyRole("admin", "gerente"), DisableProducto);

router.get<{ sucursalId: string }>("/inventory/:sucursalId", verifyToken, GetInventoryBySucursal);
router.get("/categorias", verifyToken, GetCategorias);
router.post("/inventory/update", verifyToken, verifyRole("admin", "gerente", "trabajador"), validate(schemas.updateStock), UpdateStock);

export default router;
