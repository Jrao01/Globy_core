import type { Request, Response, RequestHandler } from "express";
import { Prisma } from "../generated/index.js";
import { getConfig, updateConfig, createConfig } from "../services/ConfigService.js";

export const GetConfig: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = await getConfig();
    res.json({ message: "Configuración encontrada", data: config });
  } catch (error: any) {
    if (error.message === "NOT_FOUND") {
      res.status(404).json({ message: "Configuración no encontrada" });
      return;
    }
    console.error("Error al obtener config:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const UpdateConfig: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const data = req.body as Prisma.EmpresaConfigUpdateInput;
  try {
    const config = await updateConfig(data);
    res.json({ message: "Configuración actualizada correctamente", data: config });
  } catch (error) {
    console.error("Error al actualizar config:", error);
    res.status(500).json({ message: "Error al actualizar la configuración" });
  }
};

export const CreateConfig: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const data = req.body as Prisma.EmpresaConfigCreateInput;
  try {
    const config = await createConfig(data);
    res.json({ message: "Configuración creada exitosamente", data: config });
  } catch (error) {
    console.error("Error al crear config:", error);
    res.status(500).json({ message: "Error al crear la configuración" });
  }
};
