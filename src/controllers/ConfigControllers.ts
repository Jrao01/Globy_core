import type { Request, Response, RequestHandler } from "express";
import { Prisma } from "../generated/index.js";
import prisma from "../config/prisma.js";
import { getConfig, updateConfig, createConfig } from "../services/ConfigService.js";

export const GetConfig: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log("[ConfigControllers] [GetConfig]");
    const config = await getConfig();
    res.json({ message: "Configuración encontrada", data: config });
  } catch (error: any) {
    if (error.message === "NOT_FOUND") {
      res.status(404).json({ message: "Configuración no encontrada" });
      return;
    }
    console.error("Error al obtener config:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const UpdateConfig: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const data = req.body as Prisma.EmpresaConfigUpdateInput;
  try {
    console.log("[ConfigControllers] [UpdateConfig] body:", JSON.stringify(req.body, null, 2));
    const config = await updateConfig(data);
    res.json({ message: "Configuración actualizada correctamente", data: config });
  } catch (error) {
    console.error("Error al actualizar config:", error);
    res.status(500).json({ message: "Error al actualizar la configuración" });
  }
};

export const CreateConfig: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const data = req.body as Prisma.EmpresaConfigCreateInput;
  try {
    console.log("[ConfigControllers] [CreateConfig] body:", JSON.stringify(req.body, null, 2));
    const config = await createConfig(data);
    res.json({ message: "Configuración creada exitosamente", data: config });
  } catch (error) {
    console.error("Error al crear config:", error);
    res.status(500).json({ message: "Error al crear la configuración" });
  }
};

export const ListarSinergias: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const sinergias = await prisma.categoriaSinergia.findMany({
      where: { activo: true },
      orderBy: { categoriaEmpresa: "asc" },
    });
    res.json({ data: sinergias });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const CrearSinergia: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoriaEmpresa, categoriaTractora, peso } = req.body;
    if (!categoriaEmpresa || !categoriaTractora) {
      res.status(400).json({ message: "categoriaEmpresa y categoriaTractora son requeridos" });
      return;
    }
    const sinergia = await prisma.categoriaSinergia.create({
      data: { categoriaEmpresa, categoriaTractora, peso: peso ?? 1.0 },
    });
    res.json({ data: sinergia });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const ActualizarSinergia: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { categoriaEmpresa, categoriaTractora, peso, activo } = req.body;
    const data: any = {};
    if (categoriaEmpresa !== undefined) data.categoriaEmpresa = categoriaEmpresa;
    if (categoriaTractora !== undefined) data.categoriaTractora = categoriaTractora;
    if (peso !== undefined) data.peso = peso;
    if (activo !== undefined) data.activo = activo;
    const sinergia = await prisma.categoriaSinergia.update({
      where: { id: parseInt(id) },
      data,
    });
    res.json({ data: sinergia });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const EliminarSinergia: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.categoriaSinergia.update({ where: { id: parseInt(id) }, data: { activo: false } });
    res.json({ message: "Sinergia eliminada" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const SeedSinergiasDefault: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const defaults = [
      { categoriaEmpresa: "Ropa Deportiva", categoriaTractora: "Gimnasio", peso: 2.0 },
      { categoriaEmpresa: "Ropa Deportiva", categoriaTractora: "Parque", peso: 1.5 },
      { categoriaEmpresa: "Ropa Deportiva", categoriaTractora: "Estadio", peso: 1.5 },
      { categoriaEmpresa: "Farmacia", categoriaTractora: "Hospital", peso: 2.0 },
      { categoriaEmpresa: "Farmacia", categoriaTractora: "Clínica", peso: 2.0 },
      { categoriaEmpresa: "Farmacia", categoriaTractora: "Doctor", peso: 1.5 },
      { categoriaEmpresa: "Restaurante", categoriaTractora: "Oficina", peso: 1.5 },
      { categoriaEmpresa: "Restaurante", categoriaTractora: "Centro Comercial", peso: 1.5 },
      { categoriaEmpresa: "Restaurante", categoriaTractora: "Cine", peso: 1.0 },
      { categoriaEmpresa: "Supermercado", categoriaTractora: "Banco", peso: 1.0 },
      { categoriaEmpresa: "Supermercado", categoriaTractora: "Farmacia", peso: 1.0 },
      { categoriaEmpresa: "Electrónica", categoriaTractora: "Universidad", peso: 1.5 },
      { categoriaEmpresa: "Electrónica", categoriaTractora: "Oficina", peso: 1.0 },
      { categoriaEmpresa: "Juguetería", categoriaTractora: "Supermercado", peso: 1.0 },
      { categoriaEmpresa: "Juguetería", categoriaTractora: "Parque", peso: 1.5 },
      { categoriaEmpresa: "Ferretería", categoriaTractora: "Construcción", peso: 2.0 },
      { categoriaEmpresa: "Ferretería", categoriaTractora: "Taller", peso: 1.5 },
      { categoriaEmpresa: "Librería", categoriaTractora: "Escuela", peso: 2.0 },
      { categoriaEmpresa: "Librería", categoriaTractora: "Universidad", peso: 1.5 },
      { categoriaEmpresa: "Panadería", categoriaTractora: "Supermercado", peso: 1.0 },
      { categoriaEmpresa: "Panadería", categoriaTractora: "Escuela", peso: 1.0 },
    ];
    for (const d of defaults) {
      await prisma.categoriaSinergia.upsert({
        where: { categoriaEmpresa_categoriaTractora: { categoriaEmpresa: d.categoriaEmpresa, categoriaTractora: d.categoriaTractora } },
        create: d,
        update: { peso: d.peso },
      });
    }
    res.json({ message: `${defaults.length} sinergias cargadas`, data: defaults.length });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* ═══════════════════════════════════════════
   COEFICIENTES DE ESTACIONALIDAD
   ═══════════════════════════════════════════ */

export const ListarCoeficientes: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const coeficientes = await prisma.coeficienteFestividad.findMany({
      orderBy: { mes: "asc" },
    });
    res.json({ data: coeficientes });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const ActualizarCoeficiente: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { coeficienteConsumoMasivo, coeficienteTecnologia, coeficienteRopa, coeficienteRestaurantes } = req.body;
    const personalId = (req as any).userId; // from auth middleware

    // Calcular promedio de los 4 coeficientes
    const promedio = (
      (coeficienteConsumoMasivo || 0) +
      (coeficienteTecnologia || 0) +
      (coeficienteRopa || 0) +
      (coeficienteRestaurantes || 0)
    ) / 4;

    const coeficiente = await prisma.coeficienteFestividad.update({
      where: { id: parseInt(id) },
      data: {
        coeficienteConsumoMasivo: coeficienteConsumoMasivo ?? undefined,
        coeficienteTecnologia: coeficienteTecnologia ?? undefined,
        coeficienteRopa: coeficienteRopa ?? undefined,
        coeficienteRestaurantes: coeficienteRestaurantes ?? undefined,
        coeficientePromedio: Math.round(promedio * 100) / 100,
        updatedBy: personalId ?? undefined,
      },
    });
    res.json({ data: coeficiente });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* ═══════════════════════════════════════════
   CIUDADES DE VENEZUELA (POBLACIÓN)
   ═══════════════════════════════════════════ */

export const ListarCiudades: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, region } = req.query;
    const where: any = {};
    if (search) where.nombre = { contains: search as string };
    if (region) where.region = { contains: region as string };

    const ciudades = await prisma.ciudadPoblacion.findMany({
      where,
      orderBy: { poblacion: "desc" },
      take: 50,
    });
    res.json({ data: ciudades });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const SyncCiudadesFromAPI: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const allCities: any[] = [];
    let offset = 0;
    const limit = 10;
    let hasMore = true;

    while (hasMore) {
      const url = `https://geodb-free-service.wirefreethought.com/v1/geo/cities?countryIds=VE&types=CITY&limit=${limit}&offset=${offset}`;
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as any;
      const cities = data.data || [];
      allCities.push(...cities);
      const hasNext = Array.isArray(data.links) && data.links.some((l: any) => l.rel === "next");
      if (cities.length < limit || !hasNext) {
        hasMore = false;
      } else {
        offset += limit;
        await new Promise(r => setTimeout(r, 500));
      }
    }

    let count = 0;
    for (const city of allCities) {
      try {
        await prisma.ciudadPoblacion.upsert({
          where: { nombre_region: { nombre: city.name, region: city.region } },
          create: {
            nombre: city.name,
            region: city.region,
            poblacion: city.population,
            latitud: city.latitude,
            longitud: city.longitude,
          },
          update: { poblacion: city.population },
        });
        count++;
      } catch {}
    }

    res.json({ message: `${count} ciudades sincronizadas`, data: { count, total: allCities.length } });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* ═══════════════════════════════════════════
   CONSULTAR CIUDAD ESPECÍFICA (GeoDB + Fallback)
   ═══════════════════════════════════════════ */

const FALLBACK_CIUDADES: Record<string, { nombre: string; region: string; poblacion: number; latitud: number; longitud: number }> = {
  "san juan de los morros": {
    nombre: "San Juan de los Morros",
    region: "Guárico",
    poblacion: 137329,
    latitud: 9.9015,
    longitud: -67.3543,
  },
};

export const ConsultarCiudad: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const nombre = (req.query.nombre as string || "").trim();
    if (!nombre) {
      res.status(400).json({ message: "El parámetro 'nombre' es requerido" });
      return;
    }

    // Buscar primero en la base de datos local
    const local = await prisma.ciudadPoblacion.findFirst({
      where: { nombre: { contains: nombre } },
    });
    if (local) {
      res.json({ message: "Ciudad encontrada en base local", data: local, fuente: "local" });
      return;
    }

    // Buscar en GeoDB API por prefijo de nombre
    const encoded = encodeURIComponent(nombre);
    const url = `https://geodb-free-service.wirefreethought.com/v1/geo/cities?namePrefix=${encoded}&countryIds=VE&types=CITY&limit=5`;
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });

    if (response.ok) {
      const data = await response.json() as any;
      const cities = data.data || [];
      // Buscar coincidencia exacta (case-insensitive)
      const match = cities.find((c: any) =>
        c.name.toLowerCase() === nombre.toLowerCase() ||
        c.name.toLowerCase().includes(nombre.toLowerCase())
      );
      if (match) {
        const result = {
          nombre: match.name,
          region: match.region,
          poblacion: match.population || 0,
          latitud: match.latitude,
          longitud: match.longitude,
        };
        // Guardar en DB para futuras consultas
        await prisma.ciudadPoblacion.upsert({
          where: { nombre_region: { nombre: result.nombre, region: result.region } },
          create: result,
          update: { poblacion: result.poblacion, latitud: result.latitud, longitud: result.longitud },
        });
        res.json({ message: "Ciudad encontrada en GeoDB", data: result, fuente: "geodb" });
        return;
      }
    }

    // Fallback local por nombre normalizado
    const key = nombre.toLowerCase().trim();
    const fallback = FALLBACK_CIUDADES[key];
    if (fallback) {
      // Guardar en DB
      await prisma.ciudadPoblacion.upsert({
        where: { nombre_region: { nombre: fallback.nombre, region: fallback.region } },
        create: fallback,
        update: { poblacion: fallback.poblacion },
      });
      res.json({ message: "Ciudad encontrada en datos locales", data: fallback, fuente: "fallback" });
      return;
    }

    res.status(404).json({ message: `Ciudad '${nombre}' no encontrada ni en GeoDB ni en datos locales` });
  } catch (error: any) {
    console.error("[ConsultarCiudad] Error:", error);
    res.status(500).json({ message: error.message || "Error interno al consultar ciudad" });
  }
};
