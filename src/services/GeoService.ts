import prisma from "../config/prisma.js";

// --- CACHÉ EN MEMORIA ---
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

const PRIVADAS = /^(::1|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;

function esIpPrivada(ip: string): boolean {
  return PRIVADAS.test(ip);
}

async function guardarGeoEnCache(geo: any) {
  cache.set(geo.ip, { data: geo, timestamp: Date.now() });
  return geo;
}

// --- REVERSE GEOCODING (Nominatim) ---
const nominatimCache = new Map<string, any>();

async function reverseGeocode(lat: number, lng: number): Promise<{ pais: string | null; ciudad: string | null }> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (nominatimCache.has(key)) {
    return nominatimCache.get(key);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=es`;
    const res = await fetch(url, { headers: { "User-Agent": "GlobyApp/1.0" } });
    if (!res.ok) return { pais: null, ciudad: null };

    const data = await res.json();
    const address = data.address || {};

    const pais = address.country || null;
    const ciudad = address.city || address.town || address.village || address.county || null;

    const result = { pais, ciudad };
    nominatimCache.set(key, result);
    return result;
  } catch {
    return { pais: null, ciudad: null };
  }
}

async function obtenerCoordenadasDeConexion(ip: string): Promise<any | null> {
  try {
    const conexion = await prisma.conexion.findFirst({
      where: {
        ip,
        latitud: { not: 0 },
        longitud: { not: 0 },
      },
      orderBy: { fecha: "desc" },
      select: { latitud: true, longitud: true },
    });

    if (!conexion) return null;

    const { pais, ciudad } = await reverseGeocode(conexion.latitud, conexion.longitud);

    const geo = {
      ip,
      proveedor: "Red local",
      ciudad,
      pais,
      latitud: conexion.latitud,
      longitud: conexion.longitud,
    };

    const saved = await prisma.geoIP.upsert({
      where: { ip },
      create: geo,
      update: geo,
    });

    return guardarGeoEnCache(saved);
  } catch {
    return null;
  }
}

export async function getGeoByIP(ip: string): Promise<any | null> {
  const limpia = ip.replace(/^::ffff:/, "");

  // 1. Buscar en caché en memoria
  const cached = cache.get(limpia);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // 2. Buscar en DB
  const existente = await prisma.geoIP.findUnique({ where: { ip: limpia } });
  if (existente) {
    return guardarGeoEnCache(existente);
  }

  // 3. Si es IP privada, buscar coordenadas en tabla Conexion + reverse geocoding
  if (esIpPrivada(limpia)) {
    return obtenerCoordenadasDeConexion(limpia);
  }

  // 4. Fetch a ip.guide
  try {
    const res = await fetch(`https://ip.guide/${limpia}`);
    if (!res.ok) return null;
    const text = await res.text();
    const data = JSON.parse(text);

    const geo = {
      ip: limpia,
      proveedor: data.network?.name ?? null,
      ciudad: data.location?.city ?? null,
      pais: data.location?.country ?? null,
      latitud: data.location?.latitude ?? null,
      longitud: data.location?.longitude ?? null,
    };

    const saved = await prisma.geoIP.upsert({
      where: { ip: limpia },
      create: geo,
      update: geo,
    });

    return guardarGeoEnCache(saved);
  } catch {
    return null;
  }
}
