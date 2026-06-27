import type { Request, Response, RequestHandler } from "express";
import { updateBcvPrice, fetchBcvPrices } from "../services/BcvService.js";

export const SyncBcvPrice: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log("[BcvControllers] [SyncBcvPrice]");
    const result = await updateBcvPrice();
    res.json({ message: `BCV actualizado: USD=${result.usd}, EUR=${result.eur}`, data: result });
  } catch (error: any) {
    console.error("Error al sincronizar BCV:", error);
    res.status(500).json({ message: error.message || "Error al obtener precio BCV" });
  }
};

export const CheckBcvPrice: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log("[BcvControllers] [CheckBcvPrice]");
    const { usd, eur } = await fetchBcvPrices();
    res.json({ data: { usd, eur } });
  } catch (error: any) {
    console.error("Error al consultar BCV:", error);
    res.status(500).json({ message: error.message || "Error al consultar BCV" });
  }
};
