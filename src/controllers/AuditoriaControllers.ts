import type { Request, Response, RequestHandler } from "express";
import prisma from "../config/prisma.js";
import type { AuthRequest } from "../types/index.js";

export const ListarAuditoria: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const metodo = req.query.metodo as string | undefined;
    const ruta = req.query.ruta as string | undefined;
    const ip = req.query.ip as string | undefined;
    const desde = req.query.desde as string | undefined;
    const hasta = req.query.hasta as string | undefined;

    const where: any = {};

    if (metodo) where.metodo = metodo.toUpperCase();
    if (ruta) where.ruta = { contains: ruta };
    if (ip) where.ip = { contains: ip };
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = new Date(desde);
      if (hasta) {
        const hastaDate = new Date(hasta);
        hastaDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = hastaDate;
      }
    }

    const [data, total] = await Promise.all([
      prisma.auditoria.findMany({
        where,
        include: { geoIP: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditoria.count({ where }),
    ]);

    res.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("Error al listar auditoría:", error);
    res.status(500).json({ message: error.message || "Error al obtener registros de auditoría" });
  }
};
