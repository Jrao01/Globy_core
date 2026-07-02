import prisma from "../config/prisma.js";

export const createChat = async (compraId: number, repartidorId: number, clienteId: number) => {
  const existing = await prisma.chat.findUnique({ where: { compraId } });
  if (existing) return existing;

  return prisma.chat.create({
    data: { compraId, repartidorId, clienteId },
    include: { compra: true, repartidor: true, cliente: true },
  });
};

export const getChatByCompra = async (compraId: number) => {
  return prisma.chat.findUnique({
    where: { compraId },
    include: {
      compra: { include: { sucursal: true, detalles: { include: { producto: true } } } },
      repartidor: { select: { id: true, nombre: true, apellido: true, telefono: true } },
      cliente: { select: { id: true, nombre: true, apellido: true, telefono: true, direccion: true, coordenadasLat: true, coordenadasLng: true } },
    },
  });
};

export const getMensajes = async (chatId: number) => {
  return prisma.mensaje.findMany({
    where: { chatId },
    orderBy: { createdAt: "asc" },
  });
};

export const enviarMensaje = async (chatId: number, emisorTipo: string, emisorId: number, contenido: string) => {
  return prisma.mensaje.create({
    data: { chatId, emisorTipo, emisorId, contenido },
  });
};
