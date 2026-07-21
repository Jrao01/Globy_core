import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

export const schemas = {
  clienteRegister: z.object({
    nombre: z.string().min(1).max(100),
    apellido: z.string().min(1).max(100),
    cedula: z.string().min(1).max(20),
    correo: z.string().email(),
    password: z.string().min(6).max(100),
    telefono: z.string().max(20).optional(),
    direccion: z.string().max(255).optional(),
  }),

  clienteLogin: z.object({
    correo: z.string().email(),
    password: z.string().min(1),
  }),

  personalRegister: z.object({
    nombre: z.string().min(1).max(100),
    apellido: z.string().min(1).max(100),
    cedula: z.string().min(1).max(20),
    correo: z.string().email(),
    password: z.string().min(6).max(100),
    telefono: z.string().max(20).optional(),
    rol: z.enum(["admin", "gerente", "trabajador", "delivery"]).optional(),
    sucursalId: z.number().int().positive().optional(),
  }),

  createProducto: z.object({
    nombre: z.string().min(1).max(200),
    tipo: z.string().min(1).max(100),
    descripcion: z.string().max(500).optional(),
    precioBase: z.number().positive(),
    moneda: z.enum(["USD", "EUR"]).optional(),
    emailProveedor: z.string().email(),
    categoriaId: z.number().int().positive(),
  }),

  createCompra: z.object({
    clienteId: z.number().int().positive(),
    sucursalId: z.number().int().positive(),
    items: z.array(z.object({
      productoId: z.number().int().positive(),
      cantidad: z.number().int().positive(),
      precioUnit: z.number().positive().optional(),
    })).min(1),
    tipo: z.enum(["compra_web", "compra_directa"]).optional(),
    metodoPago: z.enum(["transferencia", "pago_movil", "efectivo_bs", "efectivo_usd"]).optional(),
    refPago: z.string().max(50).optional().nullable(),
    direccionEntrega: z.string().max(500).optional(),
    coordenadasLat: z.number().optional(),
    coordenadasLng: z.number().optional(),
    distanciaKm: z.number().optional(),
    costoEnvio: z.number().optional(),
  }),

  competitorSearch: z.object({
    categories: z.array(z.string().min(1)).min(1),
    city: z.array(z.string().min(1)).min(1),
    maxCrawledPlacesPerSearch: z.number().int().positive().max(100),
  }),

  updateStock: z.object({
    sucursalId: z.string().or(z.number()),
    productoId: z.string().or(z.number()),
    stockActual: z.number().int().min(0).optional(),
    stockMinimo: z.number().int().min(0).optional(),
    cantVentas: z.number().int().min(0).optional(),
    estadoStock: z.string().optional(),
    status: z.string().optional(),
  }),

  createOferta: z.object({
    nombre: z.string().min(1).max(200),
    descripcion: z.string().max(500).optional(),
    tipo: z.enum(["porcentaje", "monto_fijo"]),
    valor: z.number().positive(),
    montoMinimo: z.number().positive().optional(),
    montoMaximo: z.number().positive().optional(),
    fechaInicio: z.string(),
    fechaFin: z.string(),
    prioridad: z.number().int().min(0).optional(),
    categoriaId: z.number().int().positive().optional(),
    productoId: z.number().int().positive().optional(),
    sucursalIds: z.array(z.number().int().positive()),
    excepcionIds: z.array(z.number().int().positive()),
  }),
};

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      res.status(400).json({ message: "Datos de entrada inválidos", errors });
      return;
    }
    req.body = result.data;
    next();
  };
}
