import type { Request, Response, RequestHandler } from "express";
import {
  createPedido,
  getAvailablePedidos,
  getPedidosByRepartidor,
  getPedidosByCliente,
  assignPedidoToRepartidor,
  updatePedidoStatus,
  getPedidoById,
} from "../services/CompraService.js";
import type { AuthRequest, IdParams } from "../types/index.js";

export const CreatePedido: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clienteId, sucursalId, items } = req.body;
    if (!clienteId || !sucursalId || !Array.isArray(items)) {
      res.status(400).json({ message: "clienteId, sucursalId e items son requeridos" });
      return;
    }
    const pedido = await createPedido(parseInt(clienteId), parseInt(sucursalId), items);
    res.status(201).json({ message: "Pedido creado", data: pedido });
  } catch (error: any) {
    if (error.message === "PRODUCT_NOT_FOUND") {
      res.status(404).json({ message: "Producto no encontrado en items" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error creando pedido" });
  }
};

export const GetAvailable: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const pedidos = await getAvailablePedidos();
    res.json({ data: pedidos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener pedidos disponibles" });
  }
};

export const GetMine: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }
    const userId = typeof user.id === "string" ? Number(user.id) : user.id;
    if (Number.isNaN(userId)) {
      res.status(400).json({ message: "ID de repartidor inválido" });
      return;
    }
    const pedidos = await getPedidosByRepartidor(userId);
    res.json({ data: pedidos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener pedidos del repartidor" });
  }
};

export const AssignPedido: RequestHandler<IdParams> = async (req: AuthRequest<IdParams>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }
    if (!id) {
      res.status(400).json({ message: "ID de pedido es requerido" });
      return;
    }
    const pedidoId = Number(id);
    const userId = typeof user.id === "string" ? Number(user.id) : user.id;
    if (Number.isNaN(pedidoId) || Number.isNaN(userId)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const updated = await assignPedidoToRepartidor(pedidoId, userId);
    res.json({ message: "Pedido asignado", data: updated });
  } catch (error: any) {
    if (error.message === "NOT_FOUND") {
      res.status(404).json({ message: "Pedido no encontrado" });
      return;
    }
    if (error.message === "ALREADY_ASSIGNED") {
      res.status(409).json({ message: "Pedido ya asignado" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error asignando pedido" });
  }
};

export const UpdateStatus: RequestHandler<IdParams> = async (req: AuthRequest<IdParams>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!id) {
      res.status(400).json({ message: "ID de pedido es requerido" });
      return;
    }
    if (!status) {
      res.status(400).json({ message: "Status es requerido" });
      return;
    }
    const pedidoId = Number(id);
    if (Number.isNaN(pedidoId)) {
      res.status(400).json({ message: "ID de pedido inválido" });
      return;
    }
    const updated = await updatePedidoStatus(pedidoId, status);
    res.json({ message: "Status actualizado", data: updated });
  } catch (error: any) {
    if (error.message === "NOT_FOUND") {
      res.status(404).json({ message: "Pedido no encontrado" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error actualizando status" });
  }
};

export const GetPedido: RequestHandler<IdParams> = async (req: Request<IdParams>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ message: "ID de pedido es requerido" });
      return;
    }
    const pedidoId = Number(id);
    if (Number.isNaN(pedidoId)) {
      res.status(400).json({ message: "ID de pedido inválido" });
      return;
    }
    const pedido = await getPedidoById(pedidoId);
    res.json({ data: pedido });
  } catch (error: any) {
    if (error.message === "NOT_FOUND") {
      res.status(404).json({ message: "Pedido no encontrado" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error al obtener pedido" });
  }
};

export const GetClienteMisPedidos: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }
    const clienteId = typeof user.id === "string" ? Number(user.id) : user.id;
    if (Number.isNaN(clienteId)) {
      res.status(400).json({ message: "ID de cliente inválido" });
      return;
    }
    const pedidos = await getPedidosByCliente(clienteId, {});
    res.json({ data: pedidos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener pedidos del cliente" });
  }
};

export const GetPedidosByClienteController: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clienteId = parseInt(req.params.clienteId as string);
    if (isNaN(clienteId)) {
      res.status(400).json({ message: "clienteId inválido" });
      return;
    }

    const requester = req.user;
    const { fechaInicio, fechaFin, categoriaId, precioMin, precioMax } = req.query;

    // Gerente can only see pedidos from their sucursal
    const filters: any = {};
    if (requester?.rol === "gerente" && requester?.sucursalId) {
      filters.sucursalId = requester.sucursalId;
    }
    if (fechaInicio) filters.fechaInicio = fechaInicio;
    if (fechaFin) filters.fechaFin = fechaFin;
    if (categoriaId) filters.categoriaId = parseInt(categoriaId as string);
    if (precioMin) filters.precioMin = parseFloat(precioMin as string);
    if (precioMax) filters.precioMax = parseFloat(precioMax as string);

    const pedidos = await getPedidosByCliente(clienteId, filters);
    res.json({ data: pedidos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener pedidos del cliente" });
  }
};
