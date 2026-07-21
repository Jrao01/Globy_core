import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index.js";
import prisma from "../config/prisma.js";

export function auditoriaMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const ip = req.clientIp || "0.0.0.0";
  const ruta = req.originalUrl || req.url;
  const metodo = req.method;

  if (ruta === "/ping" || ruta.startsWith("/config/upload-logo")) {
    next();
    return;
  }

  // Posponer la escritura al final del request, cuando verifyToken ya seteó req.user
  _res.on("finish", () => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;

      let clienteId: number | null = null;
      let personalId: number | null = null;
      let dispositivoId: string | null = null;

      if (user) {
        if (user.rol === "cliente") {
          clienteId = Number(user.id);
        } else {
          personalId = Number(user.id);
        }
      } else {
        // Usuario no autenticado: leer fingerprint del header que envía el frontend
        const deviceHeader = req.headers["x-device-id"];
        if (typeof deviceHeader === "string") {
          dispositivoId = deviceHeader;
        }
      }

      prisma.auditoria.create({
        data: {
          ip,
          ruta,
          metodo,
          clienteId,
          personalId,
          dispositivoId,
          geoIPId: req.geo?.id ?? null,
        },
      }).catch(() => {
        // Fallo silencioso: no debe bloquear
      });
    } catch {
      // Fallo silencioso
    }
  });

  next();
}
