import prisma from "../config/prisma.js";
import { Prisma } from "../generated/index.js";
import type { Sucursal } from "../generated/index.js";

export const createSucursal = async (
  data: Prisma.SucursalCreateInput
): Promise<Sucursal> => {
  return await prisma.sucursal.create({ data });
};

export const getAllSucursales = async () => {
  return await prisma.sucursal.findMany({
    include: {
      _count: { select: { personal: true, inventarios: true } },
    },
  });
};

export const updateSucursal = async (
  id: number,
  updateData: Prisma.SucursalUpdateInput
): Promise<Sucursal> => {
  if (!id) throw new Error("ID_REQUIRED");
  return await prisma.sucursal.update({ where: { id }, data: updateData });
};

export const getSucursalById = async (id: number) => {
  const sucursal = await prisma.sucursal.findUnique({
    where: { id },
    include: {
      personal: {
        select: { id: true, nombre: true, apellido: true, rol: true },
      },
    },
  });
  if (!sucursal) throw new Error("NOT_FOUND");
  return sucursal;
};
