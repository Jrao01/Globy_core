import prisma from "../config/prisma.js";
import { Prisma } from "../generated/index.js";
import type { Producto } from "../generated/index.js";

export const createProducto = async (
  categoriaId: number,
  rest: Prisma.ProductoCreateInput
): Promise<Producto> => {
  return await prisma.producto.create({
    data: {
      ...rest,
      categoria: { connect: { id: categoriaId } },
    },
  });
};

export const getAllProductos = async (): Promise<Producto[]> => {
  return await prisma.producto.findMany();
};

export const updateProducto = async (
  id: number,
  updateData: Prisma.ProductoUpdateInput
): Promise<Producto> => {
  if (!id) throw new Error("ID_REQUIRED");
  return await prisma.producto.update({ where: { id }, data: updateData });
};

export const getProductoById = async (id: number): Promise<Producto> => {
  const producto = await prisma.producto.findUnique({ where: { id } });
  if (!producto) throw new Error("NOT_FOUND");
  return producto;
};

export const getCategorias = async () => {
  return await prisma.categoria.findMany();
};

export const getInventoryBySucursal = async (sucursalId: number) => {
  return await prisma.inventario.findMany({
    where: { sucursalId },
    include: { producto: true },
  });
};

export const updateStock = async (
  sucursalId: number,
  productoId: number,
  stock: number
) => {
  return await prisma.inventario.upsert({
    where: { sucursalId_productoId: { sucursalId, productoId } },
    update: { stockActual: stock },
    create: {
      sucursalId,
      productoId,
      stockActual: stock,
      stockMinimo: 5,
    },
  });
};

// Ensure the `status` column exists in the Producto table (SQLite)
export const ensureProductoStatusColumn = async () => {
  // Check pragma table_info for column
  const cols: Array<{ name: string }> = await prisma.$queryRaw`PRAGMA table_info("Producto")` as any;
  const has = cols.some((c) => c.name === "status");
  if (!has) {
    await prisma.$executeRaw`ALTER TABLE Producto ADD COLUMN status BOOLEAN DEFAULT 1`;
  }
};

export const setProductoStatus = async (productoId: number, status: boolean) => {
  await ensureProductoStatusColumn();
  await prisma.$executeRaw`
    UPDATE Producto SET status = ${status ? 1 : 0} WHERE id = ${productoId}
  `;
  // return the current row via raw query to include the status
  const rows: any = await prisma.$queryRaw`
    SELECT *, status FROM Producto WHERE id = ${productoId}
  `;
  return Array.isArray(rows) ? rows[0] : rows;
};
