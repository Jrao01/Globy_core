import type { Request, Response, RequestHandler } from "express";
import prisma from "../config/prisma.js";
import type { Sucursal, SucursalCreateInput, SucursalUpdateInput } from "../generated/models.js";

export const CreateSucursal: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const data = req.body as SucursalCreateInput;
    try {
        const sucursal = await prisma.sucursal.create({ data });
        res.status(201).json({ message: "Sucursal creada correctamente", data: sucursal });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al crear sucursal" });
    }
};

export const GetAllSucursales: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const sucursales = await prisma.sucursal.findMany({
            include: {
                _count: {
                    select: { personal: true, inventarios: true }
                }
            }
        });
        res.json({ data: sucursales });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener sucursales" });
    }
};

export const UpdateSucursal: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const { id, ...updateData } = req.body as { id: number } & SucursalUpdateInput;

    if (!id) {
        res.status(400).json({ message: "ID de la sucursal es requerido" });
        return;
    }

    try {
        const updated = await prisma.sucursal.update({
            where: { id },
            data: updateData
        });
        res.json({ message: "Sucursal actualizada correctamente", data: updated });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al actualizar sucursal" });
    }
};

export const GetSucursalById: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.body;
    try {
        const sucursal = await prisma.sucursal.findUnique({
            where: { id },
            include: {
                personal: {
                    select: { id: true, nombre: true, apellido: true, rol: true }
                }
            }
        });

        if (!sucursal) {
            res.status(404).json({ message: "Sucursal no encontrada" });
            return;
        }

        res.json({ data: sucursal });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener sucursal" });
    }
};
