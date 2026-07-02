import prisma from "../config/prisma.js";
import { getExchangeRates, convertirABs } from "../utils/exchangeRate.js";

export interface CreateOfertaInput {
  nombre: string;
  descripcion?: string;
  tipo: "porcentaje" | "monto_fijo";
  valor: number;
  montoMinimo?: number;
  montoMaximo?: number;
  fechaInicio: string;
  fechaFin: string;
  prioridad?: number;
  categoriaId?: number;
  productoId?: number;
  sucursalIds: number[];
  excepcionIds: number[];
}

export const crearOferta = async (data: CreateOfertaInput) => {
  return prisma.oferta.create({
    data: {
      nombre: data.nombre,
      descripcion: data.descripcion,
      tipo: data.tipo,
      valor: data.valor,
      montoMinimo: data.montoMinimo,
      montoMaximo: data.montoMaximo,
      fechaInicio: new Date(data.fechaInicio),
      fechaFin: new Date(data.fechaFin),
      prioridad: data.prioridad ?? 0,
      categoriaId: data.categoriaId ?? null,
      productoId: data.productoId ?? null,
      sucursales: {
        create: data.sucursalIds.map((id) => ({ sucursalId: id })),
      },
      excepciones: {
        create: data.excepcionIds.map((id) => ({ productoId: id })),
      },
    },
    include: { sucursales: true, excepciones: true, categoria: true, producto: true },
  });
};

export const actualizarOferta = async (id: number, data: CreateOfertaInput) => {
  await prisma.ofertaSucursal.deleteMany({ where: { ofertaId: id } });
  await prisma.ofertaExcepcion.deleteMany({ where: { ofertaId: id } });

  return prisma.oferta.update({
    where: { id },
    data: {
      nombre: data.nombre,
      descripcion: data.descripcion,
      tipo: data.tipo,
      valor: data.valor,
      montoMinimo: data.montoMinimo,
      montoMaximo: data.montoMaximo,
      fechaInicio: new Date(data.fechaInicio),
      fechaFin: new Date(data.fechaFin),
      prioridad: data.prioridad ?? 0,
      categoriaId: data.categoriaId ?? null,
      productoId: data.productoId ?? null,
      sucursales: {
        create: data.sucursalIds.map((id) => ({ sucursalId: id })),
      },
      excepciones: {
        create: data.excepcionIds.map((id) => ({ productoId: id })),
      },
    },
    include: { sucursales: true, excepciones: true, categoria: true, producto: true },
  });
};

export const listarOfertas = async (sucursalId?: number) => {
  const where: any = {};
  if (sucursalId) {
    where.sucursales = { some: { sucursalId } };
  }
  return prisma.oferta.findMany({
    where,
    include: {
      sucursales: { include: { sucursal: true } },
      excepciones: { include: { producto: true } },
      categoria: true,
      producto: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

export const obtenerOferta = async (id: number) => {
  return prisma.oferta.findUnique({
    where: { id },
    include: {
      sucursales: { include: { sucursal: true } },
      excepciones: { include: { producto: true } },
      categoria: true,
      producto: true,
    },
  });
};

export const toggleOferta = async (id: number, activo: boolean) => {
  return prisma.oferta.update({ where: { id }, data: { activo } });
};

export const eliminarOferta = async (id: number) => {
  return prisma.oferta.delete({ where: { id } });
};

/** Calcula el mejor descuento aplicable a un producto en una sucursal */
/** Devuelve los precios con descuento de todos los productos para una sucursal (o mejores ofertas globales) */
export async function calcularPreciosGlobales(sucursalId?: number) {
  const [productos, tasas] = await Promise.all([
    prisma.producto.findMany({ include: { categoria: true } }),
    getExchangeRates(),
  ]);
  const resultado: Record<number, { precioOriginal: number; precioFinal: number; precioOriginalBs: number; precioFinalBs: number; descuento: string | null; oferta: string | null }> = {};

  for (const p of productos) {
    const calc = sucursalId
      ? await calcularPrecioConDescuento(p.id, sucursalId)
      : await calcularPrecioConDescuento(p.id);
    resultado[p.id] = {
      precioOriginal: calc.precioOriginal,
      precioFinal: calc.precioFinal,
      descuento: calc.descuento,
      oferta: calc.oferta,
      precioOriginalBs: convertirABs(calc.precioOriginal, p.moneda, tasas),
      precioFinalBs: convertirABs(calc.precioFinal, p.moneda, tasas),
    };
  }

  return resultado;
}

export async function calcularPrecioConDescuento(productoId: number, sucursalId?: number) {
  const producto = await prisma.producto.findUnique({ where: { id: productoId } });
  if (!producto) return { precioOriginal: 0, precioFinal: 0, descuento: null, oferta: null };

  const ahora = new Date();

  const ofertas = await prisma.oferta.findMany({
    where: {
      activo: true,
      fechaInicio: { lte: ahora },
      fechaFin: { gte: ahora },
      sucursales: sucursalId ? { some: { sucursalId } } : { some: {} },
      AND: [
        { OR: [{ productoId }, { categoriaId: producto.categoriaId }, { productoId: null, categoriaId: null }] },
        { NOT: { excepciones: { some: { productoId } } } },
      ],
    },
    orderBy: { prioridad: "desc" },
  });

  const precioOriginal = producto.precioBase;

  if (ofertas.length === 0 || producto.precioBase <= 0) {
    return { precioOriginal, precioFinal: precioOriginal, descuento: null, oferta: null };
  }

  const filtradas = ofertas.filter((o) => {
    if (o.montoMinimo && precioOriginal < o.montoMinimo) return false;
    if (o.montoMaximo && precioOriginal > o.montoMaximo) return false;
    return true;
  });

  if (filtradas.length === 0) {
    return { precioOriginal, precioFinal: precioOriginal, descuento: null, oferta: null };
  }

  filtradas.sort((a, b) => b.prioridad - a.prioridad);
  const mejorOferta = filtradas[0]!;

  let precioFinal = precioOriginal;
  if (mejorOferta.tipo === "porcentaje") {
    precioFinal = precioOriginal * (1 - mejorOferta.valor / 100);
  } else {
    precioFinal = Math.max(0, precioOriginal - mejorOferta.valor);
  }

  return {
    precioOriginal,
    precioFinal: Math.round(precioFinal * 100) / 100,
    descuento: mejorOferta.tipo === "porcentaje" ? `${mejorOferta.valor}%` : `$${mejorOferta.valor}`,
    oferta: mejorOferta.nombre,
  };
}
