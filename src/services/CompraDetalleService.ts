import prisma from "../config/prisma.js";

export const getDetallesByCompra = async (compraId: number) => {
  return prisma.compraDetalle.findMany({ where: { compraId }, include: { producto: true } });
};

export const addDetalle = async (compraId: number, productoId: number, cantidad: number) => {
  const producto = await prisma.producto.findUnique({ where: { id: productoId } });
  if (!producto) throw new Error("PRODUCT_NOT_FOUND");
  const precioUnit = producto.precioBase;
  const detalle = await prisma.compraDetalle.create({ data: { compraId, productoId, cantidad, precioUnit } });
  // actualizar total de la compra
  const sum = await prisma.compraDetalle.aggregate({ where: { compraId }, _sum: { cantidad: true } });
  // recalcular total sumando todas las líneas
  const detalles = await prisma.compraDetalle.findMany({ where: { compraId } });
  const total = detalles.reduce((acc, d) => acc + d.precioUnit * d.cantidad, 0);
  await prisma.compra.update({ where: { id: compraId }, data: { total } });
  return detalle;
};
