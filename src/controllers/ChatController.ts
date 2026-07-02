import type { Request, Response, RequestHandler } from "express";
import { createChat, getChatByCompra, getMensajes, enviarMensaje } from "../services/ChatService.js";
import type { AuthRequest } from "../types/index.js";

export const CreateChat: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { compraId, repartidorId, clienteId } = req.body;
    if (!compraId || !repartidorId || !clienteId) {
      res.status(400).json({ message: "compraId, repartidorId y clienteId son requeridos" });
      return;
    }
    const chat = await createChat(Number(compraId), Number(repartidorId), Number(clienteId));
    res.status(201).json({ message: "Chat creado", data: chat });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creando chat" });
  }
};

export const GetChatByCompra: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { compraId } = req.params;
    if (!compraId) {
      res.status(400).json({ message: "compraId es requerido" });
      return;
    }
    const chat = await getChatByCompra(Number(compraId));
    if (!chat) {
      res.status(404).json({ message: "Chat no encontrado" });
      return;
    }
    res.json({ data: chat });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener chat" });
  }
};

export const GetMensajes: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { compraId } = req.params;
    if (!compraId) {
      res.status(400).json({ message: "compraId es requerido" });
      return;
    }
    const chat = await getChatByCompra(Number(compraId));
    if (!chat) {
      res.status(404).json({ message: "Chat no encontrado" });
      return;
    }
    const mensajes = await getMensajes(chat.id);
    res.json({ data: mensajes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener mensajes" });
  }
};

export const EnviarMensaje: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { compraId } = req.params;
    const { contenido, emisorTipo, emisorId } = req.body;
    if (!compraId || !contenido || !emisorTipo || !emisorId) {
      res.status(400).json({ message: "compraId, contenido, emisorTipo y emisorId son requeridos" });
      return;
    }
    const chat = await getChatByCompra(Number(compraId));
    if (!chat) {
      res.status(404).json({ message: "Chat no encontrado" });
      return;
    }
    const mensaje = await enviarMensaje(chat.id, emisorTipo, Number(emisorId), contenido);
    res.status(201).json({ message: "Mensaje enviado", data: mensaje });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al enviar mensaje" });
  }
};
