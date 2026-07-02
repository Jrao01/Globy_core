import type { Request, Response, RequestHandler } from "express";
import { Prisma } from "../generated/index.js";
import prisma from "../config/prisma.js";
import { getConfig, updateConfig, createConfig } from "../services/ConfigService.js";

export const GetConfig: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log("[ConfigControllers] [GetConfig]");
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
    console.log("[ConfigControllers] [UpdateConfig] body:", JSON.stringify(req.body, null, 2));
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
    console.log("[ConfigControllers] [CreateConfig] body:", JSON.stringify(req.body, null, 2));
    const config = await createConfig(data);
    res.json({ message: "Configuración creada exitosamente", data: config });
  } catch (error) {
    console.error("Error al crear config:", error);
    res.status(500).json({ message: "Error al crear la configuración" });
  }
};

export const ListarSinergias: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const sinergias = await prisma.categoriaSinergia.findMany({
      where: { activo: true },
      orderBy: { categoriaEmpresa: "asc" },
    });
    res.json({ data: sinergias });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const CrearSinergia: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoriaEmpresa, categoriaTractora, peso } = req.body;
    if (!categoriaEmpresa || !categoriaTractora) {
      res.status(400).json({ message: "categoriaEmpresa y categoriaTractora son requeridos" });
      return;
    }
    const sinergia = await prisma.categoriaSinergia.create({
      data: { categoriaEmpresa, categoriaTractora, peso: peso ?? 1.0 },
    });
    res.json({ data: sinergia });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const EliminarSinergia: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.categoriaSinergia.update({ where: { id: parseInt(id) }, data: { activo: false } });
    res.json({ message: "Sinergia eliminada" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const SeedSinergiasDefault: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const defaults = [
      { categoriaEmpresa: "Ropa Deportiva", categoriaTractora: "Gimnasio", peso: 2.0 },
      { categoriaEmpresa: "Ropa Deportiva", categoriaTractora: "Parque", peso: 1.5 },
      { categoriaEmpresa: "Ropa Deportiva", categoriaTractora: "Estadio", peso: 1.5 },
      { categoriaEmpresa: "Farmacia", categoriaTractora: "Hospital", peso: 2.0 },
      { categoriaEmpresa: "Farmacia", categoriaTractora: "Clínica", peso: 2.0 },
      { categoriaEmpresa: "Farmacia", categoriaTractora: "Doctor", peso: 1.5 },
      { categoriaEmpresa: "Restaurante", categoriaTractora: "Oficina", peso: 1.5 },
      { categoriaEmpresa: "Restaurante", categoriaTractora: "Centro Comercial", peso: 1.5 },
      { categoriaEmpresa: "Restaurante", categoriaTractora: "Cine", peso: 1.0 },
      { categoriaEmpresa: "Supermercado", categoriaTractora: "Banco", peso: 1.0 },
      { categoriaEmpresa: "Supermercado", categoriaTractora: "Farmacia", peso: 1.0 },
      { categoriaEmpresa: "Electrónica", categoriaTractora: "Universidad", peso: 1.5 },
      { categoriaEmpresa: "Electrónica", categoriaTractora: "Oficina", peso: 1.0 },
      { categoriaEmpresa: "Juguetería", categoriaTractora: "Supermercado", peso: 1.0 },
      { categoriaEmpresa: "Juguetería", categoriaTractora: "Parque", peso: 1.5 },
      { categoriaEmpresa: "Ferretería", categoriaTractora: "Construcción", peso: 2.0 },
      { categoriaEmpresa: "Ferretería", categoriaTractora: "Taller", peso: 1.5 },
      { categoriaEmpresa: "Librería", categoriaTractora: "Escuela", peso: 2.0 },
      { categoriaEmpresa: "Librería", categoriaTractora: "Universidad", peso: 1.5 },
      { categoriaEmpresa: "Panadería", categoriaTractora: "Supermercado", peso: 1.0 },
      { categoriaEmpresa: "Panadería", categoriaTractora: "Escuela", peso: 1.0 },
    ];
    for (const d of defaults) {
      await prisma.categoriaSinergia.upsert({
        where: { categoriaEmpresa_categoriaTractora: { categoriaEmpresa: d.categoriaEmpresa, categoriaTractora: d.categoriaTractora } },
        create: d,
        update: { peso: d.peso },
      });
    }
    res.json({ message: `${defaults.length} sinergias cargadas`, data: defaults.length });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
