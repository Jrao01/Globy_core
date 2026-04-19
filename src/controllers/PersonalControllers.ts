import type { Request, Response, RequestHandler } from "express";
import prisma from "../config/prisma.js";
import type { Personal, PersonalCreateInput, PersonalUpdateInput } from "../generated/models.js";

export const PersonalRegister: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const data = req.body as PersonalCreateInput;
    try {
        const newUser = await prisma.personal.create({ data });
        const { password: _, ...safeUser } = newUser;
        res.status(201).json({ message: "Personal registrado correctamente", data: safeUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al registrar personal" });
    }
};

export const PersonalLogin: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const { correo, password } = req.body;
    try {
        const user = await prisma.personal.findUnique({ 
            where: { correo },
            include: { sucursal: true } // Traemos los datos de su sede
        });

        if (!user || user.password !== password) {
            res.status(401).json({ message: "Credenciales inválidas" });
            return;
        }

        const { password: _, ...safeUser } = user;
        res.json({ message: "Login exitoso", data: safeUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
};

export const UpdatePersonal: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const { id, ...updateData } = req.body as { id: number } & PersonalUpdateInput;

    if (!id) {
        res.status(400).json({ message: "ID del personal es requerido" });
        return;
    }

    try {
        const updated = await prisma.personal.update({
            where: { id },
            data: updateData
        });

        const { password: _, ...safeUser } = updated;
        res.json({ message: "Personal actualizado correctamente", data: safeUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al actualizar personal" });
    }
};

export const GetPersonalById: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.body;
    try {
        const user = await prisma.personal.findUnique({ 
            where: { id },
            include: { sucursal: true }
        });

        if (!user) {
            res.status(404).json({ message: "Personal no encontrado" });
            return;
        }

        const { password: _, ...safeUser } = user;
        res.json({ data: safeUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener datos" });
    }
};
