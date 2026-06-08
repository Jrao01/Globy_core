import type { Request, Response, RequestHandler } from "express";
import { ApifyService } from "../services/CompetitorsService.js";
import type { CompetidoresSearch, Competitor } from "../types/index.js";
import prisma from "../config/prisma.js";

const apifyService = new ApifyService();

export const SearchCompetitors: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters: CompetidoresSearch = req.body;
    if (!filters.categories?.length || !filters.city?.length) {
      res.status(400).json({ message: "Debe especificar al menos una categoría y una ciudad" });
      return;
    }

    const cfg = await prisma.empresaConfig.findFirst();
    const pais = cfg?.pais || "Venezuela";
    const results: Competitor[] = await apifyService.buscar(filters, pais);

    const busqueda = await prisma.busquedaCompetidor.upsert({
      where: {
        categorias_ciudades_maxPlaces: {
          categorias: JSON.stringify(filters.categories),
          ciudades: JSON.stringify(filters.city),
          maxPlaces: filters.maxCrawledPlacesPerSearch,
        },
      },
      update: { createdAt: new Date() },
      create: {
        categorias: JSON.stringify(filters.categories),
        ciudades: JSON.stringify(filters.city),
        maxPlaces: filters.maxCrawledPlacesPerSearch,
      },
    });

    // Remove old links so they get replaced with fresh results
    await prisma.competidoresBusqueda.deleteMany({ where: { busquedaId: busqueda.id } });

    for (const item of results) {
      if (!item.placeId) continue;
      const competidor = await prisma.competidor.upsert({
        where: { placeId: item.placeId },
        update: {
          nombre: item.title,
          ciudad: item.city,
          direccion: item.address,
          coordenadasLat: item.location?.lat ?? 0,
          coordenadasLng: item.location?.lng ?? 0,
          cantReviews: item.reviewsCount ?? 0,
          ratingPromedio: item.totalScore ?? null,
          tipoNegocio: item.categoryName ?? null,
          categories: JSON.stringify(item.categories ?? []),
          website: item.website ?? null,
          phone: item.phone ?? null,
          ultimaVerif: new Date(),
        },
        create: {
          placeId: item.placeId,
          nombre: item.title,
          ciudad: item.city,
          direccion: item.address,
          coordenadasLat: item.location?.lat ?? 0,
          coordenadasLng: item.location?.lng ?? 0,
          cantReviews: item.reviewsCount ?? 0,
          ratingPromedio: item.totalScore ?? null,
          tipoNegocio: item.categoryName ?? null,
          categories: JSON.stringify(item.categories ?? []),
          website: item.website ?? null,
          phone: item.phone ?? null,
        },
      });

      await prisma.competidoresBusqueda.create({
        data: {
          busquedaId: busqueda.id,
          competidorId: competidor.id,
        },
      });
    }

    res.json({
      message: `Búsqueda completada — ${results.length} competidores guardados`,
      data: { busquedaId: busqueda.id, total: results.length },
    });
  } catch (error: any) {
    console.error("Error en búsqueda de competidores:", error);
    res.status(500).json({ message: error.message || "Error al buscar competidores" });
  }
};

export const GetSearchHistory: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const busquedas = await prisma.busquedaCompetidor.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        competidores: {
          include: { competidor: true },
        },
      },
    });
    res.json({ data: busquedas });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const GetCompetitors: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const competidores = await prisma.competidor.findMany({
      orderBy: { ultimaVerif: "desc" },
    });
    res.json({ data: competidores });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
