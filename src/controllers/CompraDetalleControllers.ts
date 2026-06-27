import type { Request, Response, RequestHandler } from "express";
import type { CompraIdParams } from "../types/index.js";
import { getDetallesByCompra, addDetalle } from "../services/CompraDetalleService.js";

export const GetDetallesByCompra: RequestHandler<CompraIdParams> = async (req: Request<CompraIdParams>, res: Response): Promise<void> => {
  try {
    console.log("[CompraDetalleControllers] [GetDetallesByCompra] params:", req.params);
    const { compraId } = req.params;
    if (!compraId) {
      res.status(400).json({ message: "ID de pedido es requerido" });
      return;
    }
    const compraIdNumber = Number(compraId);
    if (Number.isNaN(compraIdNumber)) {
      res.status(400).json({ message: "ID de pedido inválido" });
      return;
    }
    const detalles = await getDetallesByCompra(compraIdNumber);
    res.json({ data: detalles });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener detalles" });
  }
};

export const AddDetalle: RequestHandler<CompraIdParams> = async (req: Request<CompraIdParams>, res: Response): Promise<void> => {
  try {
    console.log("[CompraDetalleControllers] [AddDetalle] body:", JSON.stringify(req.body, null, 2));
    console.log("[CompraDetalleControllers] [AddDetalle] params:", req.params);
    const { compraId } = req.params;
    const { productoId, cantidad } = req.body;
    if (!compraId || !productoId || !cantidad) {
      res.status(400).json({ message: "compraId, productoId y cantidad son requeridos" });
      return;
    }
    const compraIdNumber = Number(compraId);
    const productoIdNumber = Number(productoId);
    const cantidadNumber = Number(cantidad);
    if (Number.isNaN(compraIdNumber) || Number.isNaN(productoIdNumber) || Number.isNaN(cantidadNumber)) {
      res.status(400).json({ message: "IDs o cantidad inválidos" });
      return;
    }
    const detalle = await addDetalle(compraIdNumber, productoIdNumber, cantidadNumber);
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
