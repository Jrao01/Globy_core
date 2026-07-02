const OVERPASS_BASE = "https://overpass-api.de/api/interpreter";
const CACHE_TTL = 24 * 60 * 60 * 1000;

const overpassCache = new Map<string, { data: OverpassResult; timestamp: number }>();

export interface OverpassBusiness {
  name: string;
  type: string;
  lat: number;
  lng: number;
}

export interface OverpassResult {
  total: number;
  tipos: Record<string, number>;
  negocios: OverpassBusiness[];
}

const BUSINESS_TYPES: Record<string, string[]> = {
  gym: ["leisure=fitness_centre", "leisure=gym", "sport=gym"],
  parque: ["leisure=park", "leisure=playground", "leisure=sports_centre"],
  hospital: ["amenity=hospital", "amenity=clinic", "amenity=doctors", "healthcare"],
  escuela: ["amenity=school", "amenity=university", "amenity=college"],
  supermercado: ["shop=supermarket", "shop=convenience"],
  restaurante: ["amenity=restaurant", "amenity=fast_food", "amenity=cafe"],
  banco: ["amenity=bank", "amenity=atm"],
  gimnasio: ["leisure=fitness_centre", "leisure=gym"],
  teatro: ["amenity=theatre", "amenity=cinema", "leisure=cinema"],
  oficina: ["office"],
  centro_comercial: ["shop=mall", "building=commercial"],
  panaderia: ["shop=bakery"],
  farmacia: ["amenity=pharmacy"],
  iglesia: ["amenity=place_of_worship"],
  estadio: ["leisure=stadium", "leisure=sports_centre"],
  parada_bus: ["public_transport=stop_position", "highway=bus_stop"],
};

const ALL_OVERPASS_TAGS = Object.values(BUSINESS_TYPES).flat();

function buildOverpassQuery(lat: number, lng: number, radiusM: number): string {
  const filtros = ALL_OVERPASS_TAGS.map((t) => `[~"${t.split("=")[0]}"~"${t.split("=")[1]}"]`).join("");
  return `[out:json][timeout:25];node(around:${radiusM},${lat},${lng})${filtros};out body;`;
}

export async function getNearbyBusinesses(
  lat: number, lng: number,
  radiusM: number = 2000
): Promise<OverpassResult> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)},${radiusM}`;
  const cached = overpassCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const query = buildOverpassQuery(lat, lng, radiusM);
  try {
    const res = await fetch(OVERPASS_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
    const json = await res.json() as any;
    const elementos = json.elements || [];

    const negocios: OverpassBusiness[] = elementos
      .filter((e: any) => e.lat && e.lng && (e.tags?.name || e.tags?.["name:es"]))
      .slice(0, 100)
      .map((e: any) => ({
        name: e.tags?.["name:es"] || e.tags?.name || "Sin nombre",
        type: e.tags?.amenity || e.tags?.leisure || e.tags?.shop || e.tags?.office || "otro",
        lat: e.lat,
        lng: e.lng,
      }));

    const tipos: Record<string, number> = {};
    negocios.forEach((n) => {
      tipos[n.type] = (tipos[n.type] || 0) + 1;
    });

    const result: OverpassResult = { total: negocios.length, tipos, negocios };
    overpassCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (err) {
    return { total: 0, tipos: {}, negocios: [] };
  }
}

export function getBusinessTypesMap(): Record<string, string[]> {
  return { ...BUSINESS_TYPES };
}