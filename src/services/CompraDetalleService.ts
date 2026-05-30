import prisma from "../config/prisma.js";

export const getDetallesByPedido = async (pedidoId: number) => {
  return prisma.pedidoDetalle.findMany({ where: { pedidoId }, include: { producto: true } });
};

export const addDetalle = async (pedidoId: number, productoId: number, cantidad: number) => {
  const producto = await prisma.producto.findUnique({ where: { id: productoId } });
  if (!producto) throw new Error("PRODUCT_NOT_FOUND");
  const precioUnit = producto.precioBase;
  const detalle = await prisma.pedidoDetalle.create({ data: { pedidoId, productoId, cantidad, precioUnit } });
  // actualizar total del pedido
  const sum = await prisma.pedidoDetalle.aggregate({ where: { pedidoId }, _sum: { cantidad: true } });
  // recalcular total sumando todas las líneas
  const detalles = await prisma.pedidoDetalle.findMany({ where: { pedidoId } });
  const total = detalles.reduce((acc, d) => acc + d.precioUnit * d.cantidad, 0);
  await prisma.pedido.update({ where: { id: pedidoId }, data: { total } });
  return detalle;
};
