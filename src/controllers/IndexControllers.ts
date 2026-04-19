import type { Request, Response, RequestHandler, ErrorRequestHandler, NextFunction } from "express";
import prisma from "../config/prisma.js";
import type { Cliente, ClienteCreateInput } from "../generated/models.js";


export const Ping : RequestHandler = async (_req: Request, res: Response) : Promise<void> => {
    const newUser: Cliente = await prisma.cliente.create({
    data: {
      nombre: 'Juliannnnn',
      apellido: 'Juliannnnn',
      cedula: '123456789',
      correo: 'juliannnnn@example.com',
      password: 'passwordddddd',
    }
  })
  console.log('Usuario creado:', newUser)
    res.json({ message: "Pong" });
};
