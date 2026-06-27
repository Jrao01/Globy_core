import type { Response, RequestHandler } from "express";
import type { AuthRequest } from "../types/index.js";
import {
  crearOferta,
  actualizarOferta,
  listarOfertas,
  obtenerOferta,
  toggleOferta,
  eliminarOferta,
  calcularPrecioConDescuento,
  calcularPreciosGlobales,
} from "../services/OfertaService.js";

export const CrearOferta: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log("[OfertaControllers] [CrearOferta] body:", JSON.stringify(req.body, null, 2));
    const user = req.user!;
    const data = req.body;

    // Gerentes solo pueden crear ofertas para su sucursal
    if (user.rol === "gerente") {
      if (data.sucursalIds?.length !== 1 || data.sucursalIds[0] !== user.sucursalId) {
        res.status(403).json({ message: "Los gerentes solo pueden crear ofertas para su propia sucursal" });
        return;
      }
    }

    const oferta = await crearOferta(data);
    res.status(201).json({ message: "Oferta creada", data: oferta });
  } catch (error) {
    console.error("Error creando oferta:", error);
    res.status(500).json({ message: "Error al crear la oferta" });
  }
};

export const ActualizarOferta: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log("[OfertaControllers] [ActualizarOferta] body:", JSON.stringify(req.body, null, 2));
    const user = req.user!;
    const id = Number(req.params.id);
    const data = req.body;

    if (user.rol === "gerente") {
      if (data.sucursalIds?.length !== 1 || data.sucursalIds[0] !== user.sucursalId) {
        res.status(403).json({ message: "Los gerentes solo pueden modificar ofertas de su sucursal" });
        return;
      }
    }

    const oferta = await actualizarOferta(id, data);
    res.json({ message: "Oferta actualizada", data: oferta });
  } catch (error) {
    console.error("Error actualizando oferta:", error);
    res.status(500).json({ message: "Error al actualizar la oferta" });
  }
};

export const ListarOfertas: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log("[OfertaControllers] [ListarOfertas]");
    const user = req.user!;
    const sucursalId = user.rol === "gerente" ? user.sucursalId : undefined;
    const ofertas = await listarOfertas(sucursalId);
    res.json({ message: "Ofertas encontradas", data: ofertas });
  } catch (error) {
    console.error("Error listando ofertas:", error);
    res.status(500).json({ message: "Error al obtener ofertas" });
  }
};

export const ObtenerOferta: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log("[OfertaControllers] [ObtenerOferta] params:", req.params);
    const id = Number(req.params.id);
    const oferta = await obtenerOferta(id);
    if (!oferta) {
      res.status(404).json({ message: "Oferta no encontrada" });
      return;
    }
    res.json({ message: "Oferta encontrada", data: oferta });
  } catch (error) {
    console.error("Error obteniendo oferta:", error);
    res.status(500).json({ message: "Error al obtener la oferta" });
  }
};

export const ToggleOferta: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log("[OfertaControllers] [ToggleOferta] body:", JSON.stringify(req.body, null, 2));
    const id = Number(req.params.id);
    const { activo } = req.body;
    const oferta = await toggleOferta(id, activo);
    res.json({ message: activo ? "Oferta activada" : "Oferta desactivada", data: oferta });
  } catch (error) {
    console.error("Error al cambiar estado:", error);
    res.status(500).json({ message: "Error al cambiar estado" });
  }
};

export const EliminarOferta: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log("[OfertaControllers] [EliminarOferta] params:", req.params);
    const id = Number(req.params.id);
    await eliminarOferta(id);
    res.json({ message: "Oferta eliminada" });
  } catch (error) {
    console.error("Error eliminando oferta:", error);
    res.status(500).json({ message: "Error al eliminar la oferta" });
  }
};

export const PrecioConDescuento: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log("[OfertaControllers] [PrecioConDescuento] params:", req.params);
    const productoId = Number(req.params.productoId);
    const sucursalId = req.params.sucursalId ? Number(req.params.sucursalId) : undefined;
    const resultado = await calcularPrecioConDescuento(productoId, sucursalId);
    res.json({ message: "Precio calculado", data: resultado });
  } catch (error) {
    console.error("Error calculando precio:", error);
    res.status(500).json({ message: "Error al calcular precio" });
  }
};

export const PreciosGlobales: RequestHandler = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log("[OfertaControllers] [PreciosGlobales]");
    const resultado = await calcularPreciosGlobales();
    res.json({ message: "Precios calculados", data: resultado });
  } catch (error) {
    console.error("Error calculando precios:", error);
    res.status(500).json({ message: "Error al calcular precios" });
  }
};
