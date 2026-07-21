import prisma from "../config/prisma.js";
import { Prisma } from "../generated/index.js";

function calcEstadoStock(stockActual: number, stockMinimo: number): string {
  if (stockActual <= 0) return "agotado";
  if (stockActual <= stockMinimo) return "bajo";
  return "optimo";
}

export const createCompra = async (
  clienteId: number,
  sucursalId: number,
  items: { productoId: number; cantidad: number; precioUnit?: number }[],
  tipo = "compra_web",
  extra?: {
    metodoPago?: string;
    refPago?: string;
    direccionEntrega?: string;
    coordenadasLat?: number;
    coordenadasLng?: number;
    distanciaKm?: number;
    costoEnvio?: number;
  }
) => {
  console.log("[createCompra] datos recibidos:", { clienteId, sucursalId, items, tipo, extra });

  // Validate sucursal exists, otherwise fallback to first available
  let sucursal = await prisma.sucursal.findUnique({ where: { id: sucursalId } });
  if (!sucursal) {
    sucursal = await prisma.sucursal.findFirst({ where: { status: true }, orderBy: { id: "asc" } });
    if (!sucursal) throw new Error("SUCURSAL_NOT_FOUND");
    sucursalId = sucursal.id;
    console.log("[createCompra] sucursalId invÃ¡lido, usando:", sucursalId);
  }
  if (!sucursal.status) throw new Error("SUCURSAL_INACTIVE");

  const detallesPrepared = [] as any[];
  let total = 0;

  for (const it of items) {
    const producto = await prisma.producto.findUnique({ where: { id: it.productoId } });
    if (!producto) throw new Error("PRODUCT_NOT_FOUND");
    const precioUnit = it.precioUnit ?? producto.precioBase;
    const lineTotal = precioUnit * it.cantidad;
    total += lineTotal;
    detallesPrepared.push({ productoId: it.productoId, cantidad: it.cantidad, precioUnit });
  }

  const tasa = await prisma.tasaCambio.findFirst({
    where: { moneda: "USD" },
    orderBy: { fecha: "desc" },
  });

  const compra = await prisma.$transaction(async (tx) => {
    // Validate stock availability
    for (const it of items) {
      const inv = await tx.inventario.findUnique({
        where: { sucursalId_productoId: { sucursalId, productoId: it.productoId } },
      });
      const stock = inv?.stockActual ?? 0;
      if (stock < it.cantidad) {
        throw new Error("INSUFFICIENT_STOCK");
      }
    }

    const newCompra = await tx.compra.create({
      data: {
        clienteId,
        sucursalId,
        total,
        tipo,
        status: tipo === "compra_directa" ? "completada" : "pendiente",
        metodoPago: extra?.metodoPago,
        refPago: extra?.refPago,
        direccionEntrega: extra?.direccionEntrega,
        coordenadasLat: extra?.coordenadasLat,
        coordenadasLng: extra?.coordenadasLng,
        distanciaKm: extra?.distanciaKm,
        costoEnvio: extra?.costoEnvio,
        tasaCambio: tasa?.precio ?? null,
        detalles: {
          create: detallesPrepared,
        },
      },
      include: { detalles: true },
    });

    // Update inventory stock and sales count
    for (const it of items) {
      const inv = await tx.inventario.findUnique({
        where: { sucursalId_productoId: { sucursalId, productoId: it.productoId } },
      });
      if (!inv) continue; // should not happen because stock was validated
      const newStock = inv.stockActual - it.cantidad;
      const newVentas = inv.cantVentas + it.cantidad;
      const estadoStock = calcEstadoStock(newStock, inv.stockMinimo);
      await tx.inventario.update({
        where: { id: inv.id },
        data: { stockActual: newStock, cantVentas: newVentas, estadoStock },
      });
    }

    return newCompra;
  });

  return compra;
};

export const getAvailableCompras = async () => {
  return prisma.compra.findMany({
    where: { tipo: "compra_web", repartidorId: null, status: { in: ["preparado", "pendiente"] } },
    include: { cliente: true, sucursal: true, detalles: { include: { producto: true } } },
    orderBy: { fecha: "asc" },
  });
};

export const getComprasByRepartidor = async (repartidorId: number) => {
  return prisma.compra.findMany({
    where: {
      repartidorId,
      status: { notIn: ["entregado", "completada", "cancelado"] },
    },
    include: { cliente: true, sucursal: true, detalles: { include: { producto: true } } },
    orderBy: { fecha: "desc" },
  });
};

export const assignCompraToRepartidor = async (compraId: number, repartidorId: number) => {
  const compra = await prisma.compra.findUnique({ where: { id: compraId } });
  if (!compra) throw new Error("NOT_FOUND");
  if (compra.repartidorId) throw new Error("ALREADY_ASSIGNED");
  return prisma.compra.update({ where: { id: compraId }, data: { repartidorId, status: "en_camino" } });
};

const TERMINAL_STATUSES = new Set(["entregado", "completada", "cancelado"]);

const VALID_TRANSITIONS: Record<string, string[]> = {
  pendiente: ["preparado", "cancelado"],
  preparado: ["en_camino", "cancelado"],
  en_camino: ["entregado", "cancelado"],
};

export const updateCompraStatus = async (compraId: number, status: string) => {
  const compra = await prisma.compra.findUnique({ where: { id: compraId } });
  if (!compra) throw new Error("NOT_FOUND");

  if (TERMINAL_STATUSES.has(compra.status)) {
    throw new Error("TERMINAL_STATUS");
  }

  if (compra.status === status) {
    return compra;
  }

  const allowed = VALID_TRANSITIONS[compra.status];
  if (!allowed || !allowed.includes(status)) {
    throw new Error("INVALID_TRANSITION");
  }

  return prisma.compra.update({ where: { id: compraId }, data: { status } });
};

export const getCompraById = async (id: number) => {
  const compra = await prisma.compra.findUnique({
    where: { id },
    include: { cliente: true, sucursal: true, detalles: { include: { producto: true } }, repartidor: true },
  });
  if (!compra) throw new Error("NOT_FOUND");
  return compra;
};

export const verificarPagoMovil = async (referencia: string, monto: number) => {
  const params = new URLSearchParams();
  params.append("rawreferencia", referencia);
  params.append("rawmonto", monto.toString());

  const res = await fetch("http://localhost:4000/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!res.ok) throw new Error("Error al verificar pago mÃ³vil");
  return res.json();
};

export const getComprasByCliente = async (
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
  const where: Prisma.CompraWhereInput = { clienteId };

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

  return prisma.compra.findMany({
    where,
    include: {
      sucursal: true,
      detalles: { include: { producto: { include: { categoria: true } } } },
    },
    orderBy: { fecha: "desc" },
  });
};
