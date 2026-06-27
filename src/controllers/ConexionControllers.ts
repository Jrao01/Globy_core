import type { Request, Response, RequestHandler } from "express";
import prisma from "../config/prisma.js";

export const RegistrarConexion: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clienteId, dispositivoId, latitud, longitud, dispositivo } = req.body;
    const ip = (req as any).clientIp || req.ip || "0.0.0.0";

    await prisma.conexion.create({
      data: {
        clienteId: clienteId ? parseInt(clienteId) : null,
        dispositivoId: dispositivoId || null,
        ip,
        latitud: parseFloat(latitud) || 0,
        longitud: parseFloat(longitud) || 0,
        dispositivo: dispositivo || null,
      },
    });

    res.status(201).json({ message: "Conexión registrada" });
  } catch (error) {
    console.error("Error registrando conexión:", error);
    res.status(500).json({ message: "Error registrando conexión" });
  }
};

export const ObtenerTodasConexiones: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const conexiones = await prisma.conexion.findMany({
      where: {
        latitud: { not: 0 },
        longitud: { not: 0 },
      },
      select: {
        id: true,
        latitud: true,
        longitud: true,
        clienteId: true,
        fecha: true,
        dispositivo: true,
      },
      orderBy: { fecha: "desc" },
    });

    res.json({ data: conexiones });
  } catch (error) {
    console.error("Error obteniendo conexiones:", error);
    res.status(500).json({ message: "Error obteniendo conexiones" });
  }
};
