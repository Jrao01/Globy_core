import { Router } from "express";
import {
  CrearOferta,
  ActualizarOferta,
  ListarOfertas,
  ObtenerOferta,
  ToggleOferta,
  EliminarOferta,
  PrecioConDescuento,
  PreciosGlobales,
} from "../controllers/OfertaControllers.js";
import { verifyToken, verifyRole } from "../middleware/authMiddleware.js";
import { validate, schemas } from "../middleware/validate.js";

const router = Router();

// Rutas públicas de precios
router.get("/precios", PreciosGlobales);
router.get("/precio/:productoId/:sucursalId", PrecioConDescuento);
router.get("/precio/:productoId", PrecioConDescuento);

// Rutas protegidas
router.post("/", verifyToken, verifyRole("admin", "gerente"), validate(schemas.createOferta), CrearOferta);
router.get("/", verifyToken, ListarOfertas);
router.get("/:id", verifyToken, ObtenerOferta);
router.put("/:id", verifyToken, verifyRole("admin", "gerente"), validate(schemas.createOferta), ActualizarOferta);
router.patch("/:id/toggle", verifyToken, verifyRole("admin", "gerente"), ToggleOferta);
router.delete("/:id", verifyToken, verifyRole("admin"), EliminarOferta);

export default router;
