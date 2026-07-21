import prisma from "../config/prisma.js";
import { Prisma } from "../generated/index.js";

export const getConfig = async () => {
  const config = await prisma.empresaConfig.findFirst();
  if (!config) throw new Error("NOT_FOUND");
  return config;
};

export const updateConfig = async (data: Prisma.EmpresaConfigUpdateInput) => {
  const existing = await prisma.empresaConfig.findFirst();
  if (existing) {
    return await prisma.empresaConfig.update({
      where: { id: existing.id },
      data,
    });
  }
  return await prisma.empresaConfig.create({
    data: {
      ...data as Prisma.EmpresaConfigCreateInput,
      id: 1,
      nombreEmpresa: "Mi Empresa",
      rif: "J-00000000-0",
      direccionFiscal: "",
    },
  });
};

export const createConfig = async (data: Prisma.EmpresaConfigCreateInput) => {
  return await prisma.empresaConfig.create({ data });
};
