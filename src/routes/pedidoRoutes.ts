import { Router } from "express";
import {
  CreateCompra,
  GetAvailable,
  GetMine,
  GetAllCompras,
  GetClienteMisCompras,
  AssignCompra,
  UpdateStatus,
  GetCompra,
  GetComprasByClienteController,
} from "../controllers/CompraControllers.js";
import { GetDetallesByCompra, AddDetalle } from "../controllers/CompraDetalleControllers.js";
import { verifyToken, verifyRole } from "../middlewares/authMiddleware.js";
import { validate, schemas } from "../middleware/validate.js";

const router = Router();

router.post("/create", verifyToken, validate(schemas.createCompra), CreateCompra);
router.get("/all", verifyToken, verifyRole("admin", "gerente", "trabajador"), GetAllCompras);
router.get("/available", verifyToken, verifyRole("admin", "gerente", "trabajador", "delivery"), GetAvailable);
router.get("/mine", verifyToken, verifyRole("delivery"), GetMine);
router.get("/mis-compras", verifyToken, GetClienteMisCompras);
router.get("/cliente/:clienteId", verifyToken, verifyRole("admin", "gerente", "trabajador"), GetComprasByClienteController);
router.post<{ id: string }>("/:id/assign", verifyToken, verifyRole("admin", "gerente", "delivery"), AssignCompra);
router.put<{ id: string }>("/:id/status", verifyToken, verifyRole("admin", "gerente", "trabajador", "delivery"), UpdateStatus);
router.get<{ id: string }>("/:id", verifyToken, GetCompra);

// Detalles
router.get<{ compraId: string }>("/:compraId/detalles", verifyToken, GetDetallesByCompra);
router.post<{ compraId: string }>("/:compraId/detalles", verifyToken, verifyRole("admin", "gerente", "trabajador"), AddDetalle);

export default router;
