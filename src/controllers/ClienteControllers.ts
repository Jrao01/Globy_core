import type { Request, Response, RequestHandler, ErrorRequestHandler, NextFunction } from "express";
import prisma from "../config/prisma.js";
import type { Cliente, ClienteCreateInput, ClienteUpdateInput } from "../generated/models.js";


export const ClienteRegister : RequestHandler = async (req: Request, res: Response) : Promise<void> => {
    const {nombre, apellido, cedula, correo, password, direccion} = req.body as ClienteCreateInput;
    const newUser: Cliente = await prisma.cliente.create({
    data: {
      nombre,
      apellido,
      cedula,
      correo,
      direccion: direccion ?? null,
      password,
    }
  })
  console.log('Usuario creado:', newUser)
    res.json({ message: "User Register" , data : {nombre, apellido, cedula, correo, password}});
};

export const ClienteLogin : RequestHandler = async (req: Request, res: Response) : Promise<void> => {
    const {correo, password} = req.body ;
    try {
    const user: Cliente | null = await prisma.cliente.findUnique({
    where: {
      correo
    }
  })

  if(!user){
    res.status(404).json({ message: "User Not Found" });
    return;
  }

  if(user.password !== password){
    res.status(401).json({ message: "Invalid Password" });
    return;
  }

    res.json({ message: user ? "User Login" : "User Not Found" , data : {nombre : user.nombre, apellido : user.apellido, correo : user.correo, direccion : user.direccion}});
    }catch(error){
      res.status(500).json({ message: "Internal Server Error" });
      console.log(error)
    }

};

export const GetCLienteData : RequestHandler = async (req: Request, res: Response) : Promise<void> => {
    const {id} = req.body ;
    try {
    const user: Cliente | null = await prisma.cliente.findUnique({
    where: {
      id
    }
  })

  if(!user){
    res.status(404).json({ message: "User Not Found" });
    return;
  }

    res.json({ message: user ? "User Found" : "User Not Found" , data : {nombre : user.nombre, apellido : user.apellido, correo : user.correo, direccion : user.direccion}});
    }catch(error){
      res.status(500).json({ message: "Internal Server Error" });
      console.log(error)
    }

};

export const UpdateCliente: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const { id, ...updateData } = req.body as { id: number } & ClienteUpdateInput;

    if (!id) {
        res.status(400).json({ message: "ID del cliente es requerido" });
        return;
    }

    try {
        const updatedUser = await prisma.cliente.update({
            where: { id },
            data: {
                ...updateData,
                ...(updateData.direccion !== undefined && { direccion: updateData.direccion ?? null })
            }
        });

        const { password: _, ...safeUser } = updatedUser;

        res.json({
            message: "Datos actualizados correctamente",
            data: safeUser
        });

    } catch (error) {
        console.error(error);
        
        if (error instanceof Error && (error as any).code === 'P2025') {
            res.status(404).json({ message: "Cliente no encontrado" });
            return;
        }

        res.status(500).json({ message: "Error al actualizar los datos" });
    }
};
