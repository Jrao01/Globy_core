import prisma from "../config/prisma.js";
import { Prisma } from "../generated/index.js";
import type { Sucursal } from "../generated/index.js";

export const createSucursal = async (
  data: Prisma.SucursalCreateInput
): Promise<Sucursal> => {
  return await prisma.sucursal.create({ data });
};

export const getAllSucursales = async (onlyActive = false) => {
  const where = onlyActive ? { status: true } : {};
  return await prisma.sucursal.findMany({
    where,
    include: {
      _count: { select: { personal: true, inventarios: true } },
      personal: {
        where: { rol: "gerente", status: true },
        select: { id: true, nombre: true, apellido: true, correo: true, telefono: true, cedula: true, rol: true },
        take: 1,
      },
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

export const setSucursalStatus = async (id: number, status: boolean) => {
  if (!status) {
    await prisma.personal.updateMany({ where: { sucursalId: id }, data: { status: false } });
  }
  return await prisma.sucursal.update({ where: { id }, data: { status } });
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
