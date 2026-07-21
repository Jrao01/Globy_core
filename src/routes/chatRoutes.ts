import { Router } from "express";
import { CreateChat, GetChatByCompra, GetMensajes, EnviarMensaje } from "../controllers/ChatController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/create", verifyToken, CreateChat);
router.get("/:compraId", verifyToken, GetChatByCompra);
router.get("/:compraId/mensajes", verifyToken, GetMensajes);
router.post("/:compraId/mensaje", verifyToken, EnviarMensaje);

export default router;
