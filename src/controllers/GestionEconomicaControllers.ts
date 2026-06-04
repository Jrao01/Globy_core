import type { Request, Response, RequestHandler } from "express";
import prisma from "../config/prisma.js";

export const GetConfig: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    let config = await prisma.gestionEconomica.findFirst();
    if (!config) {
      config = await prisma.gestionEconomica.create({
        data: { monedaPrincipal: "USD", bcvPrice: 1, autoUpdate: true, updateFrequency: "24H" },
      });
    }
    res.json({ data: config });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const UpdateConfig: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { monedaPrincipal, bcvPrice, autoUpdate, updateFrequency } = req.body;
    let config = await prisma.gestionEconomica.findFirst();
    if (!config) {
      config = await prisma.gestionEconomica.create({ data: { monedaPrincipal: "USD", bcvPrice: 1, autoUpdate: true, updateFrequency: "24H" } });
    }
    const updated = await prisma.gestionEconomica.update({
      where: { id: config.id },
      data: {
        ...(monedaPrincipal !== undefined && { monedaPrincipal }),
        ...(bcvPrice !== undefined && { bcvPrice }),
        ...(autoUpdate !== undefined && { autoUpdate }),
        ...(updateFrequency !== undefined && { updateFrequency }),
        lastUpdate: new Date(),
      },
    });
    res.json({ message: "Configuración actualizada", data: updated });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
