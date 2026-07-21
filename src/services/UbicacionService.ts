import prisma from "../config/prisma.js";

export const updateUbicacionRepartidor = async (
  compraId: number,
  repartidorId: number,
  lat: number,
  lng: number
) => {
  const [compra] = await prisma.$transaction([
    prisma.compra.update({
      where: { id: compraId },
      data: {
        repartidorCoordenadasLat: lat,
        repartidorCoordenadasLng: lng,
        ultimaActualizacionUbicacion: new Date(),
      },
    }),
    prisma.ubicacionLog.create({
      data: {
        compraId,
        lat,
        lng,
      },
    }),
  ]);

  return compra;
};

export const getUbicacionRepartidor = async (compraId: number) => {
  const compra = await prisma.compra.findUnique({
    where: { id: compraId },
    select: {
      repartidorCoordenadasLat: true,
      repartidorCoordenadasLng: true,
      ultimaActualizacionUbicacion: true,
      repartidor: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
        },
      },
    },
  });

  if (!compra) {
    throw new Error("COMPRA_NOT_FOUND");
  }

  return {
    lat: compra.repartidorCoordenadasLat,
    lng: compra.repartidorCoordenadasLng,
    updatedAt: compra.ultimaActualizacionUbicacion,
    repartidor: compra.repartidor,
  };
};

export const getHistorialUbicacion = async (compraId: number) => {
  const logs = await prisma.ubicacionLog.findMany({
    where: { compraId },
    orderBy: { createdAt: "asc" },
    select: {
      lat: true,
      lng: true,
      createdAt: true,
    },
  });

  return logs;
};

export const getMisUbicacionesEnTransito = async (repartidorId: number) => {
  const compras = await prisma.compra.findMany({
    where: {
      repartidorId,
      status: { in: ["preparado", "en_camino"] },
    },
    select: {
      id: true,
      repartidorCoordenadasLat: true,
      repartidorCoordenadasLng: true,
      ultimaActualizacionUbicacion: true,
      direccionEntrega: true,
      coordenadasLat: true,
      coordenadasLng: true,
    },
  });

  return compras;
};
