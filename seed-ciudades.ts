import { PrismaClient } from "./src/generated/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});

const prisma = new PrismaClient({ adapter });

interface GeoDBCity {
  id: number;
  type: string;
  name: string;
  country: string;
  countryCode: string;
  region: string;
  regionCode: string;
  latitude: number;
  longitude: number;
  population: number;
}

async function fetchAllCities(): Promise<GeoDBCity[]> {
  const allCities: GeoDBCity[] = [];
  let offset = 0;
  const limit = 10;
  let hasMore = true;

  while (hasMore) {
    const url = `https://geodb-free-service.wirefreethought.com/v1/geo/cities?countryIds=VE&types=CITY&limit=${limit}&offset=${offset}`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as any;
      const cities = data.data || [];
      allCities.push(...cities);
      console.log(`  📡 Obtenidas ${allCities.length} ciudades...`);
      const hasNext = Array.isArray(data.links) && data.links.some((l: any) => l.rel === "next");
      if (cities.length < limit || !hasNext) {
        hasMore = false;
      } else {
        offset += limit;
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (err) {
      console.error(`  ❌ Error obteniendo ciudades en offset ${offset}:`, err);
      hasMore = false;
    }
  }

  return allCities;
}

async function main() {
  console.log("🌱 Cargando ciudades de Venezuela desde GeoDB API...\n");

  const cities = await fetchAllCities();

  if (cities.length === 0) {
    console.log("⚠️  No se obtuvieron ciudades de la API. Cargando fallback...");
    // Fallback: ciudades principales hardcodeadas
    const fallback = [
      { nombre: "Caracas", region: "Distrito Capital", poblacion: 1442111, latitud: 10.5, longitud: -66.916666666 },
      { nombre: "Maracaibo", region: "Zulia", poblacion: 1551539, latitud: 10.666666666, longitud: -71.633333333 },
      { nombre: "Valencia", region: "Carabobo", poblacion: 1385621, latitud: 10.166666666, longitud: -68.0 },
      { nombre: "Barquisimeto", region: "Lara", poblacion: 1120718, latitud: 10.067777777, longitud: -69.334444444 },
      { nombre: "Ciudad Guayana", region: "Bolívar", poblacion: 877518, latitud: 8.373888888, longitud: -62.561111111 },
      { nombre: "Maracay", region: "Aragua", poblacion: 837423, latitud: 10.233333333, longitud: -67.6 },
      { nombre: "Barcelona", region: "Anzoátegui", poblacion: 523477, latitud: 10.133333333, longitud: -64.683333333 },
      { nombre: "Maturín", region: "Monagas", poblacion: 540014, latitud: 9.466666666, longitud: -63.183333333 },
      { nombre: "Cumaná", region: "Sucre", poblacion: 358907, latitud: 10.466666666, longitud: -64.166666666 },
      { nombre: "San Cristóbal", region: "Táchira", poblacion: 416572, latitud: 7.766666666, longitud: -72.225 },
      { nombre: "Barinas", region: "Barinas", poblacion: 353851, latitud: 8.633333333, longitud: -70.216666666 },
      { nombre: "Ciudad Bolívar", region: "Bolívar", poblacion: 372367, latitud: 8.116666666, longitud: -63.55 },
      { nombre: "Mérida", region: "Mérida", poblacion: 304663, latitud: 8.593333333, longitud: -71.158888888 },
      { nombre: "Cabimas", region: "Zulia", poblacion: 332977, latitud: 10.4, longitud: -71.433333333 },
      { nombre: "Puerto La Cruz", region: "Anzoátegui", poblacion: 346037, latitud: 10.233333333, longitud: -64.633333333 },
      { nombre: "Los Teques", region: "Miranda", poblacion: 283339, latitud: 10.345555555, longitud: -67.038333333 },
      { nombre: "Guarenas", region: "Miranda", poblacion: 271321, latitud: 10.466666666, longitud: -66.583333333 },
      { nombre: "Acarigua", region: "Portuguesa", poblacion: 290830, latitud: 9.566666666, longitud: -69.166666666 },
      { nombre: "Punto Fijo", region: "Falcón", poblacion: 284498, latitud: 11.716666666, longitud: -70.183333333 },
      { nombre: "Guatire", region: "Miranda", poblacion: 192500, latitud: 10.483333333, longitud: -66.55 },
      { nombre: "San Juan de los Morros", region: "Guárico", poblacion: 137329, latitud: 9.9015, longitud: -67.3543 },
    ];
    for (const c of fallback) {
      await prisma.ciudadPoblacion.upsert({
        where: { nombre_region: { nombre: c.nombre, region: c.region } },
        create: c,
        update: { poblacion: c.poblacion },
      });
    }
    console.log(`✅ ${fallback.length} ciudades fallback cargadas`);
    return;
  }

  let count = 0;
  for (const city of cities) {
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
    } catch (err) {
      console.error(`  ⚠️  Error guardando ${city.name}:`, err);
    }
  }

  console.log(`\n✅ ${count} ciudades de Venezuela cargadas en la base de datos`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
