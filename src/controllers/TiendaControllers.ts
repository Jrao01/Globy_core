import type { Request, Response, RequestHandler } from "express";
import prisma from "../config/prisma.js";
import { getExchangeRates, convertirABs } from "../utils/exchangeRate.js";

export const GetTiendaProductos: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log("[TiendaControllers] [GetTiendaProductos]");
    const [productos, tasas] = await Promise.all([
      prisma.producto.findMany({
        include: {
          categoria: true,
          inventarios: { where: { sucursal: { status: true } } },
        },
      }),
      getExchangeRates(),
    ]);
    const mapped = productos.map((p) => {
      const stockTotal = p.inventarios.reduce((sum, i) => sum + i.stockActual, 0);
      return {
        id: p.id,
        nombre: p.nombre,
        tipo: p.tipo,
        descripcion: p.descripcion,
        precioBase: p.precioBase,
        moneda: p.moneda,
        precioBs: convertirABs(p.precioBase, p.moneda, tasas),
        emailProveedor: p.emailProveedor,
        imagen: p.imagen,
        categoriaId: p.categoriaId,
        categoria: p.categoria,
        stockTotal,
      };
    });
    res.json({ data: mapped, tasas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener productos" });
  }
};

export const GetTiendaCategorias: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log("[TiendaControllers] [GetTiendaCategorias]");
    const categorias = await prisma.categoria.findMany();
    res.json({ data: categorias });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener categorías" });
  }
};

export const GetTiendaProductoById: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    console.log("[TiendaControllers] [GetTiendaProductoById] params:", req.params);
    const numericId = Number(id);
    const [producto, tasas] = await Promise.all([
      prisma.producto.findUnique({
        where: { id: numericId },
        include: { categoria: true, inventarios: { where: { sucursal: { status: true } }, include: { sucursal: true } } },
      }),
      getExchangeRates(),
    ]);
    if (!producto) {
      res.status(404).json({ message: "Producto no encontrado" });
      return;
    }
    const stockTotal = producto.inventarios.reduce((sum, i) => sum + i.stockActual, 0);

    const relacionados = await prisma.producto.findMany({
      where: { categoriaId: producto.categoriaId, id: { not: numericId } },
      take: 6,
      include: { categoria: true, inventarios: { where: { sucursal: { status: true } } } },
    });
    const relacionadosMapped = relacionados.map((r) => ({
      ...r,
      moneda: r.moneda,
      precioBs: convertirABs(r.precioBase, r.moneda, tasas),
      stockTotal: r.inventarios.reduce((sum, i) => sum + i.stockActual, 0),
    }));

    res.json({
      data: {
        ...producto,
        moneda: producto.moneda,
        precioBs: convertirABs(producto.precioBase, producto.moneda, tasas),
        stockTotal,
        relacionados: relacionadosMapped,
      },
      tasas,
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener producto" });
  }
};
