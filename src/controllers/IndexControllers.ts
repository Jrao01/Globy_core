import type { Request, Response, RequestHandler } from "express";
import prisma from "../config/prisma.js";
import type { Sucursal, Personal } from "../generated/index.js";


export const Ping : RequestHandler = async (_req: Request, res: Response) : Promise<void> => {

  const newSucursal: Sucursal = await prisma.sucursal.create({
    data: {
      nombre: 'Sucursal 1',
      ciudad: 'Ciudad 1',
      direccion: 'Direccion 1',
      coordenadasLat: 1,
      coordenadasLng: 1,
      tipo: 'Principal',
      status: true,
    }
  })

    const newUser: Personal = await prisma.personal.create({
    data: {
      nombre: 'Admin',
      apellido: 'Admin',
      cedula: '00.000.000',
      correo: 'admin@gmail.com',
      password: 'admin123',
      rol: 'admin',
      status: true,
      sucursalId: null, // Admin global sin sede fija
    }
  })


  
  console.log('Usuario creado:', newUser)
    res.json({ message: "Pong" });
};
