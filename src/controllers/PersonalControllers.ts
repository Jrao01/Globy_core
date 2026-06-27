import type { Request, Response, RequestHandler } from "express";
import type { AuthRequest, IdParams } from "../types/index.js";
import { Prisma } from "../generated/index.js";
import {
  registerPersonal,
  loginPersonal,
  updatePersonal,
  getPersonalById,
  getAllPersonal,
  setPersonalStatus,
} from "../services/PersonalService.js";

export const PersonalRegister: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log("[PersonalControllers] [PersonalRegister] body:", JSON.stringify(req.body, null, 2));
    const requester = req.user;
    if (!requester || (requester.rol !== "admin" && requester.rol !== "gerente")) {
      res.status(403).json({ message: "No tienes permisos para crear personal" });
      return;
    }

    const data = req.body as Prisma.PersonalCreateInput;
    const required = ["nombre", "apellido", "cedula", "correo", "password"];
    for (const f of required) {
      if (!Object.prototype.hasOwnProperty.call(data, f) || (data as any)[f] === undefined) {
        res.status(400).json({ message: `${f} es requerido` });
        return;
      }
    }

    // validate role if provided
    const allowedRoles = ["admin", "gerente", "trabajador", "delivery"];
    if ((data as any).rol && !allowedRoles.includes((data as any).rol)) {
      res.status(400).json({ message: "rol inválido" });
      return;
    }

    // Gerente can only register trabajador/delivery and only for their own sucursal
    if (requester.rol === "gerente") {
      if ((data as any).rol === "admin" || (data as any).rol === "gerente") {
        res.status(403).json({ message: "No puedes crear usuarios con rol admin o gerente" });
        return;
      }
      (data as any).sucursalId = requester.sucursalId;
    } else {
      if ((data as any).sucursalId) {
        const s = parseInt((data as any).sucursalId as any);
        if (isNaN(s)) {
          res.status(400).json({ message: "sucursalId inválido" });
          return;
        }
        (data as any).sucursalId = s;
      }
    }

    const newUser = await registerPersonal(data);
    res.status(201).json({ message: "Personal registrado correctamente", data: newUser });
  } catch (error: any) {
    if (error?.code === "P2002") {
      const fields = error?.meta?.target ?? error?.meta?.driverAdapterError?.cause?.fields ?? [];
      const fieldName = Array.isArray(fields) ? fields[0] : "correo o cédula";
      res.status(409).json({ message: `Ya existe un registro con ese ${fieldName}` });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error al registrar personal" });
  }
};

export const LogInPersonal: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { correo, password } = req.body;
  try {
    console.log("[PersonalControllers] [LogInPersonal] body:", JSON.stringify(req.body, null, 2));
    const result = await loginPersonal(correo, password);
    res.json({ message: "Login exitoso", data: result.user, token: result.token });
  } catch (error: any) {
    if (error.message === "INVALID_CREDENTIALS") {
      res.status(401).json({ message: "Credenciales inválidas" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const UpdatePersonal: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { id, ...updateData } = req.body as { id: number } & Prisma.PersonalUpdateInput;
  if (!id) {
    res.status(400).json({ message: "ID del personal es requerido" });
    return;
  }
  try {
    console.log("[PersonalControllers] [UpdatePersonal] body:", JSON.stringify(req.body, null, 2));
    const updated = await updatePersonal(id, updateData);
    res.json({ message: "Personal actualizado correctamente", data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar personal" });
  }
};

export const GetPersonalById: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  // Support fetching by body.id or params.id
  const idString = req.params.id;
  const bodyId = req.body.id;
  let id: number | undefined;
  if (idString) {
    id = Number(idString);
  } else if (typeof bodyId === "number") {
    id = bodyId;
  } else if (typeof bodyId === "string") {
    id = Number(bodyId);
  }
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ message: "ID es requerido" });
    return;
  }
  try {
    console.log("[PersonalControllers] [GetPersonalById] body:", JSON.stringify(req.body, null, 2));
    console.log("[PersonalControllers] [GetPersonalById] params:", req.params);
    const user = await getPersonalById(id);
    res.json({ data: user });
  } catch (error: any) {
    if (error.message === "USER_NOT_FOUND") {
      res.status(404).json({ message: "Personal no encontrado" });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error al obtener datos" });
  }
};

export const GetAllPersonal: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("[PersonalControllers] [GetAllPersonal]");
    const personnel = await getAllPersonal();
    res.json({ data: personnel });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener la lista de personal" });
  }
};

export const EnablePersonal: RequestHandler<IdParams> = async (req: Request<IdParams>, res: Response): Promise<void> => {
  try {
    console.log("[PersonalControllers] [EnablePersonal] params:", req.params);
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ message: "ID es requerido" });
      return;
    }
    const personalId = Number(id);
    if (Number.isNaN(personalId)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const updated = await setPersonalStatus(personalId, true);
    res.json({ message: "Personal habilitado", data: updated });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Error al habilitar personal" });
  }
};

export const DisablePersonal: RequestHandler<IdParams> = async (req: Request<IdParams>, res: Response): Promise<void> => {
  try {
    console.log("[PersonalControllers] [DisablePersonal] params:", req.params);
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ message: "ID es requerido" });
      return;
    }
    const personalId = Number(id);
    if (Number.isNaN(personalId)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const updated = await setPersonalStatus(personalId, false);
    res.json({ message: "Personal deshabilitado", data: updated });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Error al deshabilitar personal" });
  }
};
