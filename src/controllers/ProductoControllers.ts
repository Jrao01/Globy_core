import type { Request, Response, RequestHandler } from "express";
import prisma from "../config/prisma.js";
import type { Producto, ProductoCreateInput, ProductoUpdateInput } from "../generated/models.js";

export const CreateProducto: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const data = req.body as ProductoCreateInput;
    try {
        const producto = await prisma.producto.create({ data });
        res.status(201).json({ message: "Producto creado correctamente", data: producto });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al crear producto" });
    }
};

export const GetAllProductos: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const productos = await prisma.producto.findMany();
        res.json({ data: productos });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener productos" });
    }
};

export const UpdateProducto: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const { id, ...updateData } = req.body as { id: number } & ProductoUpdateInput;

    if (!id) {
        res.status(400).json({ message: "ID del producto es requerido" });
        return;
    }

    try {
        const updated = await prisma.producto.update({
            where: { id },
            data: updateData
        });
        res.json({ message: "Producto actualizado correctamente", data: updated });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al actualizar producto" });
    }
};

export const GetProductoById: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.body;
    try {
        const producto = await prisma.producto.findUnique({ where: { id } });
        if (!producto) {
            res.status(404).json({ message: "Producto no encontrado" });
            return;
        }
        res.json({ data: producto });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener producto" });
    }
};
