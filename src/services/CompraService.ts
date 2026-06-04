import prisma from "../config/prisma.js";
import { Prisma } from "../generated/index.js";

export const createPedido = async (
  clienteId: number,
  sucursalId: number,
  items: { productoId: number; cantidad: number }[]
) => {
  // calcular total y preparar detalles con precioUnit
  const detallesPrepared = [] as any[];
  let total = 0;

  for (const it of items) {
    const producto = await prisma.producto.findUnique({ where: { id: it.productoId } });
    if (!producto) throw new Error("PRODUCT_NOT_FOUND");
    const precioUnit = producto.precioBase;
    const lineTotal = precioUnit * it.cantidad;
    total += lineTotal;
    detallesPrepared.push({ productoId: it.productoId, cantidad: it.cantidad, precioUnit });
  }

  const pedido = await prisma.pedido.create({
    data: {
      clienteId,
      sucursalId,
      total,
      detalles: {
        create: detallesPrepared,
      },
    },
    include: { detalles: true },
  });

  return pedido;
};

export const getAvailablePedidos = async () => {
  return prisma.pedido.findMany({
    where: { repartidorId: null, status: { in: ["preparado", "pendiente"] } },
    include: { cliente: true, sucursal: true, detalles: { include: { producto: true } } },
    orderBy: { fecha: "asc" },
  });
};

export const getPedidosByRepartidor = async (repartidorId: number) => {
  return prisma.pedido.findMany({
    where: { repartidorId },
    include: { cliente: true, sucursal: true, detalles: { include: { producto: true } } },
    orderBy: { fecha: "desc" },
  });
};

export const assignPedidoToRepartidor = async (pedidoId: number, repartidorId: number) => {
  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido) throw new Error("NOT_FOUND");
  if (pedido.repartidorId) throw new Error("ALREADY_ASSIGNED");
  return prisma.pedido.update({ where: { id: pedidoId }, data: { repartidorId } });
};

export const updatePedidoStatus = async (pedidoId: number, status: string) => {
  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido) throw new Error("NOT_FOUND");
  return prisma.pedido.update({ where: { id: pedidoId }, data: { status } });
};

export const getPedidoById = async (id: number) => {
  const pedido = await prisma.pedido.findUnique({
    where: { id },
    include: { cliente: true, sucursal: true, detalles: { include: { producto: true } }, repartidor: true },
  });
  if (!pedido) throw new Error("NOT_FOUND");
  return pedido;
};

export const getPedidosByCliente = async (
  clienteId: number,
  filters: {
    fechaInicio?: string;
    fechaFin?: string;
    categoriaId?: number;
    precioMin?: number;
    precioMax?: number;
    sucursalId?: number;
  }
) => {
  const where: Prisma.PedidoWhereInput = { clienteId };

  if (filters.sucursalId) where.sucursalId = filters.sucursalId;
  if (filters.fechaInicio || filters.fechaFin) {
    where.fecha = {};
    if (filters.fechaInicio) where.fecha.gte = new Date(filters.fechaInicio);
    if (filters.fechaFin) where.fecha.lte = new Date(filters.fechaFin);
  }
  if (filters.precioMin !== undefined || filters.precioMax !== undefined) {
    where.total = {};
    if (filters.precioMin !== undefined) where.total.gte = filters.precioMin;
    if (filters.precioMax !== undefined) where.total.lte = filters.precioMax;
  }
  if (filters.categoriaId) {
    where.detalles = {
      some: { producto: { categoriaId: filters.categoriaId } },
    };
  }

  return prisma.pedido.findMany({
    where,
    include: {
      sucursal: true,
      detalles: { include: { producto: { include: { categoria: true } } } },
    },
    orderBy: { fecha: "desc" },
  });
};
