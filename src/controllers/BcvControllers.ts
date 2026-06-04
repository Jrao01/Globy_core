import type { Request, Response, RequestHandler } from "express";
import { updateBcvPrice, fetchBcvPrice } from "../services/BcvService.js";

export const SyncBcvPrice: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await updateBcvPrice();
    res.json({ message: `Precio BCV actualizado: ${result.price}`, data: result });
  } catch (error: any) {
    console.error("Error al sincronizar BCV:", error);
    res.status(500).json({ message: error.message || "Error al obtener precio BCV" });
  }
};

export const CheckBcvPrice: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const price = await fetchBcvPrice();
    res.json({ data: { price } });
  } catch (error: any) {
    console.error("Error al consultar BCV:", error);
    res.status(500).json({ message: error.message || "Error al consultar BCV" });
  }
};
