import { Router } from "express";
import { GetTiendaProductos, GetTiendaCategorias, GetTiendaProductoById } from "../controllers/TiendaControllers.js";

const router = Router();

router.get("/productos", GetTiendaProductos);
router.get("/categorias", GetTiendaCategorias);
router.get("/producto/:id", GetTiendaProductoById);

export default router;
