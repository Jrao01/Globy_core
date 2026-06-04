import type { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma.js";

export async function auditoriaMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const ip = req.clientIp || "0.0.0.0";
  const ruta = req.originalUrl || req.url;
  const metodo = req.method;

  // No loguear pings internos ni estáticos para no saturar DB
  if (ruta === "/ping" || ruta.startsWith("/config/upload-logo")) {
    next();
    return;
  }

  try {
    await prisma.auditoria.create({
      data: {
        ip,
        ruta,
        metodo,
        clienteId: (req as any).usuario?.id ?? null,
        geoIPId: req.geo?.id ?? null,
      },
    });
  } catch {
    // Fallo silencioso: no debe bloquear el request
  }

  next();
}
