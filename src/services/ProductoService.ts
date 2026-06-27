import prisma from "../config/prisma.js";
import { Prisma } from "../generated/index.js";
import type { Producto } from "../generated/index.js";

export const createProducto = async (
  categoriaId: number,
  rest: Prisma.ProductoCreateInput
): Promise<Producto> => {
  return await prisma.producto.create({
    data: {
      ...rest,
      categoria: { connect: { id: categoriaId } },
    },
  });
};

export const getAllProductos = async (): Promise<Producto[]> => {
  return await prisma.producto.findMany();
};

export const updateProducto = async (
  id: number,
  updateData: Prisma.ProductoUpdateInput
): Promise<Producto> => {
  if (!id) throw new Error("ID_REQUIRED");
  return await prisma.producto.update({ where: { id }, data: updateData });
};

export const getProductoById = async (id: number): Promise<Producto> => {
  const producto = await prisma.producto.findUnique({ where: { id } });
  if (!producto) throw new Error("NOT_FOUND");
  return producto;
};

export const getCategorias = async () => {
  return await prisma.categoria.findMany();
};

export const getInventoryBySucursal = async (sucursalId: number) => {
  return await prisma.inventario.findMany({
    where: { sucursalId },
    include: { producto: true },
  });
};

function calcEstadoStock(stockActual: number, stockMinimo: number): string {
  if (stockActual <= 0) return "agotado";
  if (stockActual <= stockMinimo) return "bajo";
  return "optimo";
}

export const updateInventory = async (
  sucursalId: number,
  productoId: number,
  data: { stockActual?: number; stockMinimo?: number; cantVentas?: number; estadoStock?: string; status?: string }
) => {
  const existing = await prisma.inventario.findUnique({
    where: { sucursalId_productoId: { sucursalId, productoId } },
  });
  const finalStockActual = data.stockActual ?? existing?.stockActual ?? 0;
  const finalStockMinimo = data.stockMinimo ?? existing?.stockMinimo ?? 5;
  const finalEstadoStock = data.estadoStock || calcEstadoStock(finalStockActual, finalStockMinimo);

  return await prisma.inventario.upsert({
    where: { sucursalId_productoId: { sucursalId, productoId } },
    update: {
      ...(data.stockActual !== undefined && { stockActual: data.stockActual }),
      ...(data.stockMinimo !== undefined && { stockMinimo: data.stockMinimo }),
      ...(data.cantVentas !== undefined && { cantVentas: data.cantVentas }),
      ...(data.status !== undefined && { status: data.status }),
      estadoStock: finalEstadoStock,
    },
    create: {
      sucursalId,
      productoId,
      stockActual: data.stockActual ?? 0,
      stockMinimo: data.stockMinimo ?? 5,
      cantVentas: data.cantVentas ?? 0,
      estadoStock: finalEstadoStock,
      status: data.status ?? "disponible",
    },
  });
};

export const setProductoStatus = async (productoId: number, status: boolean) => {
  const existing = await prisma.producto.findUnique({ where: { id: productoId } });
  if (!existing) throw new Error("NOT_FOUND");

  await prisma.producto.update({
    where: { id: productoId },
    data: { tipo: existing.tipo },
  });

  const updated = await prisma.producto.findUnique({ where: { id: productoId } });
  return updated;
};
