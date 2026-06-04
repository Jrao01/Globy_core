import prisma from "../config/prisma.js";

// --- CACHÉ EN MEMORIA ---
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

const PRIVADAS = /^(::1|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;

function esIpPrivada(ip: string): boolean {
  return PRIVADAS.test(ip);
}

export async function getGeoByIP(ip: string): Promise<any | null> {
  const limpia = ip.replace(/^::ffff:/, ""); // IPv6 mapped IPv4

  if (esIpPrivada(limpia)) return null;

  // 1. Buscar en caché en memoria
  const cached = cache.get(limpia);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // 2. Buscar en DB
  const existente = await prisma.geoIP.findUnique({ where: { ip: limpia } });
  if (existente) {
    cache.set(limpia, { data: existente, timestamp: Date.now() });
    return existente;
  }

  // 3. Fetch a ip.guide
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

    // Guardar en DB
    const saved = await prisma.geoIP.upsert({
      where: { ip: limpia },
      create: geo,
      update: geo,
    });

    // Guardar en caché
    cache.set(limpia, { data: saved, timestamp: Date.now() });

    return saved;
  } catch {
    return null;
  }
}
