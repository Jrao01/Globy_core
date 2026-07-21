import type { Request, Response, RequestHandler } from "express";
import { Prisma } from "../generated/index.js";
import {
  registerCliente,
  loginCliente,
  getClienteById,
  findClienteByCedula,
  getAllClientes,
  updateCliente,
  changeClientePassword,
  getClienteStats,
  getClienteConexiones,
} from "../services/ClienteService.js";
import { googleLogin } from "../services/GoogleAuthService.js";

export const ClienteRegister: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("[ClienteControllers] [ClienteRegister] body:", JSON.stringify(req.body, null, 2));
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
    console.log("[ClienteControllers] [ClienteLogin] body:", JSON.stringify(req.body, null, 2));
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
    console.log("[ClienteControllers] [GetCLienteData] body:", JSON.stringify(req.body, null, 2));
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
    console.log("[ClienteControllers] [UpdateCliente] body:", JSON.stringify(req.body, null, 2));
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

export const GetAllClientes: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log("[ClienteControllers] [GetAllClientes]");
    const clientes = await getAllClientes();
    res.json({ data: clientes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener clientes" });
  }
};

export const SearchClienteByCedula: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const cedula = req.params.cedula as string;
  if (!cedula) {
    res.status(400).json({ message: "Cédula es requerida" });
    return;
  }
  try {
    console.log("[ClienteControllers] [SearchClienteByCedula] params:", req.params);
    const user = await findClienteByCedula(cedula);
    if (!user) {
      res.status(404).json({ message: "Cliente no encontrado" });
      return;
    }
    res.json({ data: user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al buscar cliente" });
  }
};

export const ChangeClientePassword: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { id, currentPassword, newPassword } = req.body;
  if (!id || !currentPassword || !newPassword) {
    res.status(400).json({ message: "id, currentPassword y newPassword son requeridos" });
    return;
  }
  try {
    console.log("[ClienteControllers] [ChangeClientePassword] id:", id);
    await changeClientePassword(id, currentPassword, newPassword);
    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error: any) {
    if (error.message === "USER_NOT_FOUND") {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }
    if (error.message === "INVALID_PASSWORD") {
      res.status(401).json({ message: "La contraseña actual es incorrecta" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error al cambiar contraseña" });
  }
};

export const GetClienteStats: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const clienteId = parseInt(req.params.clienteId as string);
  if (isNaN(clienteId)) {
    res.status(400).json({ message: "clienteId inválido" });
    return;
  }
  try {
    console.log("[ClienteControllers] [GetClienteStats] clienteId:", clienteId);
    const stats = await getClienteStats(clienteId);
    res.json({ data: stats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener estadísticas" });
  }
};

export const GoogleAuth: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { credential } = req.body;
  if (!credential) {
    res.status(400).json({ message: "Credencial de Google es requerida" });
    return;
  }
  try {
    const result = await googleLogin(credential);
    res.json({
      message: result.isNew ? "Cuenta creada con Google" : "Inicio de sesión con Google exitoso",
      data: result.user,
      token: result.token,
    });
  } catch (error: any) {
    if (error.message === "GOOGLE_OAUTH_NOT_CONFIGURED") {
      res.status(501).json({ message: "Google OAuth no está configurado en el servidor" });
      return;
    }
    if (error.message === "GOOGLE_TOKEN_INVALID") {
      res.status(401).json({ message: "Token de Google inválido" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error al autenticar con Google" });
  }
};

export const GetClienteConexiones: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const clienteId = parseInt(req.params.clienteId as string);
  if (isNaN(clienteId)) {
    res.status(400).json({ message: "clienteId inválido" });
    return;
  }
  try {
    console.log("[ClienteControllers] [GetClienteConexiones] clienteId:", clienteId);
    const conexiones = await getClienteConexiones(clienteId);
    res.json({ data: conexiones });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener conexiones" });
  }
};
