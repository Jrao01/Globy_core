import prisma from "../config/prisma.js";
import { Prisma } from "../generated/index.js";

export const getConfig = async () => {
  const config = await prisma.empresaConfig.findFirst();
  if (!config) throw new Error("NOT_FOUND");
  return config;
};

export const updateConfig = async (data: Prisma.EmpresaConfigUpdateInput) => {
  return await prisma.empresaConfig.upsert({
    where: { id: 1 },
    update: data,
    create: { ...data as Prisma.EmpresaConfigCreateInput, id: 1 },
  });
};

export const createConfig = async (data: Prisma.EmpresaConfigCreateInput) => {
  return await prisma.empresaConfig.create({ data });
};
