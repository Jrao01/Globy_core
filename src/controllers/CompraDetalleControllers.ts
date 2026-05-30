import type { Request, Response, RequestHandler } from "express";
import type { PedidoIdParams } from "../types/index.js";
import { getDetallesByPedido, addDetalle } from "../services/CompraDetalleService.js";

export const GetDetallesByPedido: RequestHandler<PedidoIdParams> = async (req: Request<PedidoIdParams>, res: Response): Promise<void> => {
  try {
    const { pedidoId } = req.params;
    if (!pedidoId) {
      res.status(400).json({ message: "ID de pedido es requerido" });
      return;
    }
    const pedidoIdNumber = Number(pedidoId);
    if (Number.isNaN(pedidoIdNumber)) {
      res.status(400).json({ message: "ID de pedido inválido" });
      return;
    }
    const detalles = await getDetallesByPedido(pedidoIdNumber);
    res.json({ data: detalles });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener detalles" });
  }
};

export const AddDetalle: RequestHandler<PedidoIdParams> = async (req: Request<PedidoIdParams>, res: Response): Promise<void> => {
  try {
    const { pedidoId } = req.params;
    const { productoId, cantidad } = req.body;
    if (!pedidoId || !productoId || !cantidad) {
      res.status(400).json({ message: "pedidoId, productoId y cantidad son requeridos" });
      return;
    }
    const pedidoIdNumber = Number(pedidoId);
    const productoIdNumber = Number(productoId);
    const cantidadNumber = Number(cantidad);
    if (Number.isNaN(pedidoIdNumber) || Number.isNaN(productoIdNumber) || Number.isNaN(cantidadNumber)) {
      res.status(400).json({ message: "IDs o cantidad inválidos" });
      return;
    }
    const detalle = await addDetalle(pedidoIdNumber, productoIdNumber, cantidadNumber);
    res.status(201).json({ message: "Detalle agregado", data: detalle });
  } catch (error: any) {
    if (error.message === "PRODUCT_NOT_FOUND") {
      res.status(404).json({ message: "Producto no encontrado" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error al agregar detalle" });
  }
};
