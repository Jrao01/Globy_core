import type { Request, Response, RequestHandler } from "express";
import type { IdParams } from "../types/index.js";
import { Prisma } from "../generated/index.js";
import {
  createSucursal,
  getAllSucursales,
  updateSucursal,
  getSucursalById,
  setSucursalStatus,
} from "../services/SucursalService.js";

export const CreateSucursal: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("[SucursalControllers] [CreateSucursal] body:", JSON.stringify(req.body, null, 2));
    const data = req.body as Prisma.SucursalCreateInput;
    const sucursal = await createSucursal(data);
    res.status(201).json({ message: "Sucursal creada correctamente", data: sucursal });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear sucursal" });
  }
};

export const GetAllSucursales: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log("[SucursalControllers] [GetAllSucursales]");
    const sucursales = await getAllSucursales();
    res.json({ data: sucursales });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener sucursales" });
  }
};

export const UpdateSucursal: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { id, ...updateData } = req.body as { id: number } & Prisma.SucursalUpdateInput;
  if (!id) {
    res.status(400).json({ message: "ID de la sucursal es requerido" });
    return;
  }
  try {
    console.log("[SucursalControllers] [UpdateSucursal] body:", JSON.stringify(req.body, null, 2));
    const updated = await updateSucursal(id, updateData);
    res.json({ message: "Sucursal actualizada correctamente", data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar sucursal" });
  }
};

export const GetSucursalById: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.body;
  try {
    console.log("[SucursalControllers] [GetSucursalById] body:", JSON.stringify(req.body, null, 2));
    const sucursal = await getSucursalById(id);
    res.json({ data: sucursal });
  } catch (error: any) {
    if (error.message === "NOT_FOUND") {
      res.status(404).json({ message: "Sucursal no encontrada" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error al obtener sucursal" });
  }
};

export const EnableSucursal: RequestHandler<IdParams> = async (req: Request<IdParams>, res: Response): Promise<void> => {
  try {
    console.log("[SucursalControllers] [EnableSucursal] params:", req.params);
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ message: "ID es requerido" });
      return;
    }
    const sucursalId = Number(id);
    if (Number.isNaN(sucursalId)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const updated = await setSucursalStatus(sucursalId, true);
    res.json({ message: "Sucursal habilitada", data: updated });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Error al habilitar sucursal" });
  }
};

export const DisableSucursal: RequestHandler<IdParams> = async (req: Request<IdParams>, res: Response): Promise<void> => {
  try {
    console.log("[SucursalControllers] [DisableSucursal] params:", req.params);
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ message: "ID es requerido" });
      return;
    }
    const sucursalId = Number(id);
    if (Number.isNaN(sucursalId)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const updated = await setSucursalStatus(sucursalId, false);
    res.json({ message: "Sucursal deshabilitada", data: updated });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Error al deshabilitar sucursal" });
  }
};
