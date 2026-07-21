import prisma from "../config/prisma.js";
import { Prisma } from "../generated/index.js";
import type { Personal } from "../generated/index.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const SALT_ROUNDS = 10;

type SafePersonal = Omit<Personal, "password">;

export const registerPersonal = async (
  data: Prisma.PersonalCreateInput
): Promise<SafePersonal> => {
  const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
  const newUser = await prisma.personal.create({
    data: { ...data, password: hashedPassword },
  });
  const { password: _, ...safeUser } = newUser;
  return safeUser;
};

export const loginPersonal = async (
  correo: string,
  password: string
): Promise<{ user: SafePersonal; token: string }> => {
  const user = await prisma.personal.findUnique({
    where: { correo },
    include: { sucursal: true },
  });

  if (!user) throw new Error("INVALID_CREDENTIALS");
  if (!user.status) throw new Error("USER_INACTIVE");
  if (user.sucursal && !user.sucursal.status) throw new Error("SUCURSAL_INACTIVE");
  const passwordValid = await bcrypt.compare(password, user.password);
  if (!passwordValid) throw new Error("INVALID_CREDENTIALS");

  const { password: _, ...safeUser } = user;

  const token = jwt.sign(
    { id: user.id, rol: user.rol, correo: user.correo, sucursalId: user.sucursalId },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

  return { user: safeUser, token };
};

export const updatePersonal = async (
  id: number,
  updateData: Prisma.PersonalUpdateInput
): Promise<SafePersonal> => {
  if (!id) throw new Error("ID_REQUIRED");
  const dataToUpdate: any = { ...updateData };
  if (dataToUpdate.password) {
    dataToUpdate.password = await bcrypt.hash(dataToUpdate.password as string, SALT_ROUNDS);
  }
  const updated = await prisma.personal.update({ where: { id }, data: dataToUpdate });
  const { password: _, ...safeUser } = updated;
  return safeUser;
};

export const getPersonalById = async (id: number): Promise<SafePersonal> => {
  const user = await prisma.personal.findUnique({
    where: { id },
    include: { sucursal: true },
  });
  if (!user) throw new Error("USER_NOT_FOUND");
  const { password: _, ...safeUser } = user;
  return safeUser;
};

export const getAllPersonal = async (): Promise<SafePersonal[]> => {
  const personnel = await prisma.personal.findMany({
    include: { sucursal: true },
    orderBy: { createdAt: "desc" },
  });
  return personnel.map(({ password, ...rest }) => rest);
};

export const setPersonalStatus = async (id: number, status: boolean): Promise<SafePersonal> => {
  const updated = await prisma.personal.update({ where: { id }, data: { status } });
  const { password: _, ...safeUser } = updated;
  return safeUser;
};
