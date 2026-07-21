import type { Request, Response, RequestHandler } from "express";
import { updateUbicacionRepartidor, getUbicacionRepartidor, getHistorialUbicacion } from "../services/UbicacionService.js";
import type { AuthRequest } from "../types/index.js";

export const UpdateUbicacion: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { compraId } = req.params;
    const { lat, lng } = req.body;
    
    if (!compraId || !lat || !lng) {
      res.status(400).json({ message: "compraId, lat y lng son requeridos" });
      return;
    }

    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const updated = await updateUbicacionRepartidor(
      Number(compraId),
      Number(user.id),
      Number(lat),
      Number(lng)
    );

    res.json({ message: "Ubicación actualizada", data: updated });
  } catch (error: any) {
    console.error("Error actualizando ubicación:", error);
    res.status(500).json({ message: "Error al actualizar ubicación" });
  }
};

export const GetUbicacion: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { compraId } = req.params;
    
    if (!compraId) {
      res.status(400).json({ message: "compraId es requerido" });
      return;
    }

    const ubicacion = await getUbicacionRepartidor(Number(compraId));
    res.json({ data: ubicacion });
  } catch (error: any) {
    if (error.message === "COMPRA_NOT_FOUND") {
      res.status(404).json({ message: "Compra no encontrada" });
      return;
    }
    console.error("Error obteniendo ubicación:", error);
    res.status(500).json({ message: "Error al obtener ubicación" });
  }
};

export const GetHistorialUbicacion: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { compraId } = req.params;
    if (!compraId) {
      res.status(400).json({ message: "compraId es requerido" });
      return;
    }
    const historial = await getHistorialUbicacion(Number(compraId));
    res.json({ data: historial });
  } catch (error) {
    console.error("Error obteniendo historial de ubicación:", error);
    res.status(500).json({ message: "Error al obtener historial de ubicación" });
  }
};