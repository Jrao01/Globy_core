import type { Request, Response, RequestHandler } from "express";
import type { IdParams, SucursalParams } from "../types/index.js";
import { Prisma } from "../generated/index.js";
import prisma from "../config/prisma.js";
import {
  createProducto,
  getAllProductos,
  updateProducto,
  getProductoById,
  getCategorias,
  getInventoryBySucursal,
  updateInventory,
  setProductoStatus,
} from "../services/ProductoService.js";

export const CreateProducto: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { categoriaId, ...rest } = req.body;
  if (!categoriaId) {
    res.status(400).json({ message: "categoriaId es requerido" });
    return;
  }
  if (typeof categoriaId !== "string" && typeof categoriaId !== "number") {
    res.status(400).json({ message: "categoriaId inválido" });
    return;
  }
  if (!rest || !((rest as any).nombre) || ((rest as any).precioBase === undefined)) {
    res.status(400).json({ message: "nombre y precioBase son requeridos" });
    return;
  }
  try {
    const categoriaIdNumber = typeof categoriaId === "string" ? Number(categoriaId) : categoriaId;
    if (Number.isNaN(categoriaIdNumber)) {
      res.status(400).json({ message: "categoriaId inválido" });
      return;
    }
    const producto = await createProducto(categoriaIdNumber, rest);
    res.status(201).json({ message: "Producto creado correctamente", data: producto });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear producto" });
  }
};

export const GetAllProductos: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const productos = await getAllProductos();
    res.json({ data: productos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener productos" });
  }
};

export const UpdateProducto: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { id, ...updateData } = req.body as { id: number } & Prisma.ProductoUpdateInput;
  if (!id) {
    res.status(400).json({ message: "ID del producto es requerido" });
    return;
  }
  try {
    const updated = await updateProducto(id, updateData);
    res.json({ message: "Producto actualizado correctamente", data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar producto" });
  }
};

export const GetProductoById: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.body;
  if (typeof id !== "number" && typeof id !== "string") {
    res.status(400).json({ message: "ID de producto inválido" });
    return;
  }
  const productoId = typeof id === "number" ? id : Number(id);
  if (Number.isNaN(productoId)) {
    res.status(400).json({ message: "ID de producto inválido" });
    return;
  }
  try {
    const producto = await getProductoById(productoId);
    res.json({ data: producto });
  } catch (error: any) {
    if (error.message === "NOT_FOUND") {
      res.status(404).json({ message: "Producto no encontrado" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error al obtener producto" });
  }
};

export const GetProductoDetail: RequestHandler<IdParams> = async (req: Request<IdParams>, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      res.status(400).json({ message: "ID de producto inválido" });
      return;
    }
    const producto = await prisma.producto.findUnique({
      where: { id: numericId },
      include: { categoria: true, inventarios: { include: { sucursal: true } } },
    });
    if (!producto) {
      res.status(404).json({ message: "Producto no encontrado" });
      return;
    }
    const stockTotal = producto.inventarios.reduce((sum, i) => sum + i.stockActual, 0);
    const relacionados = await prisma.producto.findMany({
      where: { categoriaId: producto.categoriaId, id: { not: numericId } },
      take: 6,
      include: { categoria: true, inventarios: true },
    });
    const relacionadosMapped = relacionados.map((r) => ({
      ...r,
      stockTotal: r.inventarios.reduce((sum, i) => sum + i.stockActual, 0),
    }));
    res.json({ data: { ...producto, stockTotal, relacionados: relacionadosMapped } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener producto" });
  }
};

export const GetCategorias: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categorias = await getCategorias();
    res.json({ data: categorias });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener categorías" });
  }
};

export const GetInventoryBySucursal: RequestHandler<SucursalParams> = async (req: Request<SucursalParams>, res: Response): Promise<void> => {
  const { sucursalId } = req.params;
  if (!sucursalId) {
    res.status(400).json({ message: "ID de sucursal es requerido" });
    return;
  }
  try {
    const sucursalIdNumber = Number(sucursalId);
    if (Number.isNaN(sucursalIdNumber)) {
      res.status(400).json({ message: "ID de sucursal inválido" });
      return;
    }
    const inventory = await getInventoryBySucursal(sucursalIdNumber);
    res.json({ data: inventory });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener inventario" });
  }
};

export const UpdateStock: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { sucursalId, productoId, stockActual, stockMinimo, cantVentas, estadoStock, status } = req.body;
  try {
    const inventory = await updateInventory(
      parseInt(sucursalId),
      parseInt(productoId),
      {
        ...(stockActual !== undefined && { stockActual: parseInt(stockActual) }),
        ...(stockMinimo !== undefined && { stockMinimo: parseInt(stockMinimo) }),
        ...(cantVentas !== undefined && { cantVentas: parseInt(cantVentas) }),
        ...(estadoStock !== undefined && { estadoStock }),
        ...(status !== undefined && { status }),
      }
    );
    res.json({ message: "Inventario actualizado", data: inventory });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar inventario" });
  }
};

export const EnableProducto: RequestHandler<IdParams> = async (req: Request<IdParams>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ message: "ID del producto es requerido" });
      return;
    }
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      res.status(400).json({ message: "ID de producto inválido" });
      return;
    }
    const updated = await setProductoStatus(productId, true);
    res.json({ message: "Producto habilitado", data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al habilitar producto" });
  }
};

export const DisableProducto: RequestHandler<IdParams> = async (req: Request<IdParams>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ message: "ID del producto es requerido" });
      return;
    }
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      res.status(400).json({ message: "ID de producto inválido" });
      return;
    }
    const updated = await setProductoStatus(productId, false);
    res.json({ message: "Producto deshabilitado", data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al deshabilitar producto" });
  }
};
