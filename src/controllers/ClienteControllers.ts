import type { Request, Response, RequestHandler } from "express";
import { Prisma } from "../generated/index.js";
import {
  registerCliente,
  loginCliente,
  getClienteById,
  updateCliente,
} from "../services/ClienteService.js";

export const ClienteRegister: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = req.body as Prisma.ClienteCreateInput;
    const newUser = await registerCliente(data);
    res.status(201).json({ message: "Usuario registrado correctamente", data: newUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al registrar cliente" });
  }
};

export const ClienteLogin: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { correo, password } = req.body;
  try {
    const result = await loginCliente(correo, password);
    res.json({ message: "Login exitoso", data: result.user, token: result.token });
  } catch (error: any) {
    if (error.message === "USER_NOT_FOUND") {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }
    if (error.message === "INVALID_PASSWORD") {
      res.status(401).json({ message: "Contraseña incorrecta" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const GetCLienteData: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.body;
  try {
    const user = await getClienteById(id);
    res.json({ message: "Usuario encontrado", data: user });
  } catch (error: any) {
    if (error.message === "USER_NOT_FOUND") {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const UpdateCliente: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { id, ...updateData } = req.body as { id: number } & Prisma.ClienteUpdateInput;
  if (!id) {
    res.status(400).json({ message: "ID del cliente es requerido" });
    return;
  }
  try {
    const updated = await updateCliente(id, updateData);
    res.json({ message: "Datos actualizados correctamente", data: updated });
  } catch (error: any) {
    if (error?.code === "P2025") {
      res.status(404).json({ message: "Cliente no encontrado" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error al actualizar los datos" });
  }
};
