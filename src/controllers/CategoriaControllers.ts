import type { Request, Response, RequestHandler } from "express";
import type { IdParams } from "../types/index.js";
import { Prisma } from "../generated/index.js";
import {
  createCategoria,
  getAllCategorias,
  updateCategoria,
  deleteCategoria,
} from "../services/CategoriaService.js";

export const CreateCategoria: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("[CategoriaControllers] [CreateCategoria] body:", JSON.stringify(req.body, null, 2));
    const data = req.body as Prisma.CategoriaCreateInput;
    if (!data.nombre) {
      res.status(400).json({ message: "nombre es requerido" });
      return;
    }
    const categoria = await createCategoria(data);
    res.status(201).json({ message: "Categoría creada correctamente", data: categoria });
  } catch (error: any) {
    if (error?.code === "P2002") {
      res.status(409).json({ message: "Ya existe una categoría con ese nombre" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error al crear categoría" });
  }
};

export const GetAllCategorias: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log("[CategoriaControllers] [GetAllCategorias]");
    const categorias = await getAllCategorias();
    res.json({ data: categorias });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener categorías" });
  }
};

export const UpdateCategoria: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { id, ...data } = req.body as { id: number } & Prisma.CategoriaUpdateInput;
  if (!id) {
    res.status(400).json({ message: "ID es requerido" });
    return;
  }
  try {
    console.log("[CategoriaControllers] [UpdateCategoria] body:", JSON.stringify(req.body, null, 2));
    const updated = await updateCategoria(id, data);
    res.json({ message: "Categoría actualizada", data: updated });
  } catch (error: any) {
    if (error?.code === "P2002") {
      res.status(409).json({ message: "Ya existe una categoría con ese nombre" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error al actualizar categoría" });
  }
};

export const DeleteCategoria: RequestHandler<IdParams> = async (req: Request<IdParams>, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ message: "ID es requerido" });
    return;
  }
  const categoriaId = Number(id);
  if (Number.isNaN(categoriaId)) {
    res.status(400).json({ message: "ID inválido" });
    return;
  }
  try {
    console.log("[CategoriaControllers] [DeleteCategoria] params:", req.params);
    await deleteCategoria(categoriaId);
    res.json({ message: "Categoría eliminada" });
  } catch (error: any) {
    if (error?.code === "P2003") {
      res.status(409).json({ message: "No se puede eliminar: hay productos asociados a esta categoría" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error al eliminar categoría" });
  }
};
