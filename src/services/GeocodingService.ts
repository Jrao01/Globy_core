import prisma from "../config/prisma.js";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const CACHE_TTL = 24 * 60 * 60 * 1000;
const NOMINATIM_INTERVAL = 1100;
const USER_AGENT = "GlobyApp/1.0";

const cache = new Map<string, { lat: number; lng: number; timestamp: number }>();
let lastRequestTime = 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function geocodeDireccion(direccion: string): Promise<{ lat: number; lng: number } | null> {
  const normalized = direccion.trim().toLowerCase();
  if (!normalized) return null;

  const cached = cache.get(normalized);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { lat: cached.lat, lng: cached.lng };
  }

  const now = Date.now();
  const wait = NOMINATIM_INTERVAL - (now - lastRequestTime);
  if (wait > 0) {
    await delay(wait);
  }
  lastRequestTime = Date.now();

  try {
    const query = encodeURIComponent(`${direccion}, Venezuela`);
    const url = `${NOMINATIM_URL}?q=${query}&format=json&limit=1`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;

    const data = (await res.json()) as any[];
    if (!data?.length) return null;

    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (isNaN(lat) || isNaN(lng)) return null;

    cache.set(normalized, { lat, lng, timestamp: Date.now() });
    return { lat, lng };
  } catch {
    return null;
  }
}

export async function getCoordenadasFromConexion(clienteId: number): Promise<{ lat: number; lng: number } | null> {
  try {
    const conexion = await prisma.conexion.findFirst({
      where: {
        clienteId,
        latitud: { not: 0 },
        longitud: { not: 0 },
      },
      orderBy: { fecha: "desc" },
      select: { latitud: true, longitud: true },
    });

    if (!conexion || conexion.latitud === null || conexion.longitud === null) return null;
    return { lat: conexion.latitud, lng: conexion.longitud };
  } catch {
    return null;
  }
}
