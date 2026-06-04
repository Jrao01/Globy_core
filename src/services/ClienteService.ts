import prisma from "../config/prisma.js";
import { Prisma } from "../generated/index.js";
import type { Cliente } from "../generated/index.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

export const registerCliente = async (
  data: Prisma.ClienteCreateInput
): Promise<Omit<Cliente, "password">> => {
  const newUser = await prisma.cliente.create({
    data: {
      nombre: data.nombre,
      apellido: data.apellido,
      cedula: data.cedula,
      correo: data.correo,
      telefono: data.telefono ?? null,
      direccion: data.direccion ?? null,
      password: data.password,
    },
  });
  const { password: _, ...safeUser } = newUser;
  return safeUser;
};

export const loginCliente = async (
  correo: string,
  password: string
): Promise<{ user: Omit<Cliente, "password">; token: string }> => {
  const user = await prisma.cliente.findUnique({ where: { correo } });

  if (!user) throw new Error("USER_NOT_FOUND");
  if (user.password !== password) throw new Error("INVALID_PASSWORD");

  const { password: _, ...safeUser } = user;

  const token = jwt.sign(
    { id: user.id, rol: "cliente", correo: user.correo },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

  return { user: safeUser, token };
};

export const getClienteById = async (
  id: number
): Promise<Omit<Cliente, "password">> => {
  const user = await prisma.cliente.findUnique({ where: { id } });
  if (!user) throw new Error("USER_NOT_FOUND");
  const { password: _, ...safeUser } = user;
  return safeUser;
};

export const findClienteByCedula = async (
  cedula: string
): Promise<Omit<Cliente, "password"> | null> => {
  const user = await prisma.cliente.findUnique({ where: { cedula } });
  if (!user) return null;
  const { password: _, ...safeUser } = user;
  return safeUser;
};

export const updateCliente = async (
  id: number,
  updateData: Prisma.ClienteUpdateInput
): Promise<Omit<Cliente, "password">> => {
  const updated = await prisma.cliente.update({
    where: { id },
    data: {
      ...updateData,
      ...(updateData.direccion !== undefined && {
        direccion: updateData.direccion ?? null,
      }),
      ...(updateData.telefono !== undefined && {
        telefono: updateData.telefono ?? null,
      }),
    },
  });
  const { password: _, ...safeUser } = updated;
  return safeUser;
};

export const getAllClientes = async (): Promise<Omit<Cliente, "password">[]> => {
  const users = await prisma.cliente.findMany({ orderBy: { createdAt: "desc" } });
  return users.map(({ password: _, ...safe }) => safe);
};
