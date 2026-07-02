import type { Request, Response, RequestHandler } from "express";
import prisma from "../config/prisma.js";

export const GetHistorialTasas: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const dias = parseInt(req.query.dias as string) || 90;
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    const tasas = await prisma.tasaCambio.findMany({
      where: { fecha: { gte: desde } },
      orderBy: { fecha: "asc" },
      select: { moneda: true, precio: true, fecha: true },
    });
    const grouped: Record<string, any> = {};
    tasas.forEach((t) => {
      const key = t.fecha.toISOString().slice(0, 10);
      if (!grouped[key]) grouped[key] = { fecha: key };
      grouped[key][t.moneda.toLowerCase()] = t.precio;
    });
    res.json({ data: Object.values(grouped) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const GetConfig: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log("[GestionEconomicaControllers] [GetConfig]");
    let config = await prisma.gestionEconomica.findFirst();
    if (!config) {
      config = await prisma.gestionEconomica.create({
        data: { monedaPrincipal: "USD", autoUpdate: true },
      });
    }
    const ultimaUSD = await prisma.tasaCambio.findFirst({ where: { moneda: "USD" }, orderBy: { fecha: "desc" } });
    const ultimaEUR = await prisma.tasaCambio.findFirst({ where: { moneda: "EUR" }, orderBy: { fecha: "desc" } });
    res.json({
      data: {
        ...config,
        ultimaTasaUSD: ultimaUSD?.precio ?? 1,
        ultimaTasaEUR: ultimaEUR?.precio ?? 1,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const UpdateConfig: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("[GestionEconomicaControllers] [UpdateConfig] body:", JSON.stringify(req.body, null, 2));
    const { monedaPrincipal, autoUpdate } = req.body;
    let config = await prisma.gestionEconomica.findFirst();
    if (!config) {
      config = await prisma.gestionEconomica.create({ data: { monedaPrincipal: "USD", autoUpdate: true } });
    }
    const updated = await prisma.gestionEconomica.update({
      where: { id: config.id },
      data: {
        ...(monedaPrincipal !== undefined && { monedaPrincipal }),
        ...(autoUpdate !== undefined && { autoUpdate }),
      },
    });
    res.json({ message: "Configuración actualizada", data: updated });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
