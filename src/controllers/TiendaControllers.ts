import type { Request, Response, RequestHandler } from "express";
import prisma from "../config/prisma.js";

export const GetTiendaProductos: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const productos = await prisma.producto.findMany({
      include: {
        categoria: true,
        inventarios: true,
      },
    });
    const mapped = productos.map((p) => {
      const stockTotal = p.inventarios.reduce((sum, i) => sum + i.stockActual, 0);
      return {
        id: p.id,
        nombre: p.nombre,
        tipo: p.tipo,
        descripcion: p.descripcion,
        precioBase: p.precioBase,
        emailProveedor: p.emailProveedor,
        imagen: p.imagen,
        categoriaId: p.categoriaId,
        categoria: p.categoria,
        stockTotal,
      };
    });
    res.json({ data: mapped });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener productos" });
  }
};

export const GetTiendaCategorias: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categorias = await prisma.categoria.findMany();
    res.json({ data: categorias });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener categorías" });
  }
};

export const GetTiendaProductoById: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const numericId = Number(id);
    const producto = await prisma.producto.findUnique({
      where: { id: numericId },
      include: { categoria: true, inventarios: { include: { sucursal: true } } },
    });
    if (!producto) {
      res.status(404).json({ message: "Producto no encontrado" });
      return;
    }
    const stockTotal = producto.inventarios.reduce((sum, i) => sum + i.stockActual, 0);

    const relacionados = await prisma.producto.findMany({
      where: { categoriaId: producto.categoriaId, id: { not: numericId } },
      take: 6,
      include: { categoria: true, inventarios: true },
    });
    const relacionadosMapped = relacionados.map((r) => ({
      ...r,
      stockTotal: r.inventarios.reduce((sum, i) => sum + i.stockActual, 0),
    }));

    res.json({ data: { ...producto, stockTotal, relacionados: relacionadosMapped } });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener producto" });
  }
};
