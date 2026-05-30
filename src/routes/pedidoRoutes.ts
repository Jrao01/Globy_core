import { Router } from "express";
import {
  CreatePedido,
  GetAvailable,
  GetMine,
  AssignPedido,
  UpdateStatus,
  GetPedido,
} from "../controllers/CompraControllers.js";
import { GetDetallesByPedido, AddDetalle } from "../controllers/CompraDetalleControllers.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/create", CreatePedido);
router.get("/available", verifyToken, GetAvailable);
router.get("/mine", verifyToken, GetMine);
router.post<{ id: string }>("/:id/assign", verifyToken, AssignPedido);
router.put<{ id: string }>("/:id/status", verifyToken, UpdateStatus);
router.get<{ id: string }>("/:id", verifyToken, GetPedido);

// Detalles
router.get<{ pedidoId: string }>("/:pedidoId/detalles", verifyToken, GetDetallesByPedido);
router.post<{ pedidoId: string }>("/:pedidoId/detalles", verifyToken, AddDetalle);

export default router;
