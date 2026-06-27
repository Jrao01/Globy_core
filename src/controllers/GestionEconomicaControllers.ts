import type { Request, Response, RequestHandler } from "express";
import prisma from "../config/prisma.js";

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
