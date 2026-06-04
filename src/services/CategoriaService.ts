import prisma from "../config/prisma.js";
import { Prisma } from "../generated/index.js";

export const createCategoria = async (data: Prisma.CategoriaCreateInput) => {
  return await prisma.categoria.create({ data });
};

export const getAllCategorias = async () => {
  return await prisma.categoria.findMany({ include: { _count: { select: { productos: true } } } });
};

export const updateCategoria = async (id: number, data: Prisma.CategoriaUpdateInput) => {
  return await prisma.categoria.update({ where: { id }, data });
};

export const deleteCategoria = async (id: number) => {
  return await prisma.categoria.delete({ where: { id } });
};
