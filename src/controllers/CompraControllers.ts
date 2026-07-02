import type { Request, Response, RequestHandler } from "express";
import prisma from "../config/prisma.js";
import {
  createCompra,
  getAvailableCompras,
  getComprasByRepartidor,
  getComprasByCliente,
  assignCompraToRepartidor,
  updateCompraStatus,
  getCompraById,
} from "../services/CompraService.js";
import type { AuthRequest, IdParams } from "../types/index.js";

export const GetAllCompras: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const where: any = {};

    if (user.rol === "gerente") {
      where.sucursalId = user.sucursalId;
    } else if (user.rol === "trabajador") {
      where.sucursalId = user.sucursalId;
    }
    // admin sees all — no filter

    const compras = await prisma.compra.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombre: true, apellido: true, correo: true, cedula: true } },
        sucursal: { select: { id: true, nombre: true, ciudad: true } },
        detalles: { include: { producto: { select: { id: true, nombre: true, imagen: true } } } },
      },
      orderBy: { fecha: "desc" },
    });

    res.json({ data: compras });
  } catch (error) {
    console.error("Error obteniendo compras:", error);
    res.status(500).json({ message: "Error al obtener compras" });
  }
};

export const CreateCompra: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("[CreateCompra] body recibido:", JSON.stringify(req.body, null, 2));
    const { clienteId, sucursalId, items, tipo, metodoPago, refPago, direccionEntrega, coordenadasLat, coordenadasLng, distanciaKm, costoEnvio } = req.body;
    if (!clienteId || !sucursalId || !Array.isArray(items)) {
      console.log("[CreateCompra] validación falló - datos:", { clienteId, sucursalId, items });
      res.status(400).json({ message: "clienteId, sucursalId e items son requeridos" });
      return;
    }
    const compra = await createCompra(
      parseInt(clienteId),
      parseInt(sucursalId),
      items,
      tipo || "compra_web",
      { metodoPago, refPago, direccionEntrega, coordenadasLat, coordenadasLng, distanciaKm, costoEnvio }
    );
    res.status(201).json({ message: "Compra creada", data: compra });
  } catch (error: any) {
    if (error.message === "PRODUCT_NOT_FOUND") {
      res.status(404).json({ message: "Producto no encontrado en items" });
      return;
    }
    if (error.message === "SUCURSAL_NOT_FOUND") {
      res.status(404).json({ message: "No hay sucursales disponibles" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error creando pedido" });
  }
};

export const GetAvailable: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const compras = await getAvailableCompras();
    res.json({ data: compras });
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
    const compras = await getComprasByRepartidor(userId);
    res.json({ data: compras });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener pedidos del repartidor" });
  }
};

export const AssignCompra: RequestHandler<IdParams> = async (req: AuthRequest<IdParams>, res: Response): Promise<void> => {
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
    const compraId = Number(id);
    const userId = typeof user.id === "string" ? Number(user.id) : user.id;
    if (Number.isNaN(compraId) || Number.isNaN(userId)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const updated = await assignCompraToRepartidor(compraId, userId);
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
    const compraId = Number(id);
    if (Number.isNaN(compraId)) {
      res.status(400).json({ message: "ID de pedido inválido" });
      return;
    }
    const updated = await updateCompraStatus(compraId, status);
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

export const GetCompra: RequestHandler<IdParams> = async (req: Request<IdParams>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ message: "ID de pedido es requerido" });
      return;
    }
    const compraId = Number(id);
    if (Number.isNaN(compraId)) {
      res.status(400).json({ message: "ID de pedido inválido" });
      return;
    }
    const compra = await getCompraById(compraId);
    res.json({ data: compra });
  } catch (error: any) {
    if (error.message === "NOT_FOUND") {
      res.status(404).json({ message: "Pedido no encontrado" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error al obtener pedido" });
  }
};

export const GetClienteMisCompras: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
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
    const compras = await getComprasByCliente(clienteId, {});
    res.json({ data: compras });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener pedidos del cliente" });
  }
};

export const GetComprasByClienteController: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const compras = await getComprasByCliente(clienteId, filters);
    res.json({ data: compras });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener pedidos del cliente" });
  }
};
