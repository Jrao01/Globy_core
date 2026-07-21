import prisma from "./src/config/prisma.js";
import { geocodeDireccion, getCoordenadasFromConexion } from "./src/services/GeocodingService.js";

async function main() {
  console.log("[backfill:coords] Iniciando backfill de coordenadas...\n");

  const clientes = await prisma.cliente.findMany({
    where: { coordenadasLat: null },
    select: { id: true, nombre: true, apellido: true, direccion: true },
  });

  console.log(`[backfill:coords] ${clientes.length} clientes sin coordenadas encontrados.\n`);

  let actualizados = 0;
  let fallbackConexion = 0;
  let sinExito = 0;

  for (const cliente of clientes) {
    const nombre = `${cliente.nombre} ${cliente.apellido}`;
    const direccion = cliente.direccion?.trim();

    if (!direccion) {
      console.log(`[backfill:coords] [${cliente.id}] ${nombre} — sin direccion, intentando Conexion...`);
      const coords = await getCoordenadasFromConexion(cliente.id);
      if (coords) {
        await prisma.cliente.update({
          where: { id: cliente.id },
          data: { coordenadasLat: coords.lat, coordenadasLng: coords.lng },
        });
        fallbackConexion++;
        console.log(`  -> OK via Conexion (${coords.lat}, ${coords.lng})`);
      } else {
        sinExito++;
        console.log(`  -> Sin exito`);
      }
      continue;
    }

    console.log(`[backfill:coords] [${cliente.id}] ${nombre} — "${direccion}"`);

    const coords = await geocodeDireccion(direccion);
    if (coords) {
      await prisma.cliente.update({
        where: { id: cliente.id },
        data: { coordenadasLat: coords.lat, coordenadasLng: coords.lng },
      });
      actualizados++;
      console.log(`  -> OK via Nominatim (${coords.lat}, ${coords.lng})`);
    } else {
      const fallback = await getCoordenadasFromConexion(cliente.id);
      if (fallback) {
        await prisma.cliente.update({
          where: { id: cliente.id },
          data: { coordenadasLat: fallback.lat, coordenadasLng: fallback.lng },
        });
        fallbackConexion++;
        console.log(`  -> Fallback: OK via Conexion (${fallback.lat}, ${fallback.lng})`);
      } else {
        sinExito++;
        console.log(`  -> Sin exito`);
      }
    }
  }

  console.log(`\n[backfill:coords] Resumen:`);
  console.log(`  Total procesados: ${clientes.length}`);
  console.log(`  Actualizados via Nominatim: ${actualizados}`);
  console.log(`  Actualizados via Conexion: ${fallbackConexion}`);
  console.log(`  Sin coordenadas: ${sinExito}`);
}

main()
  .then(() => {
    console.log("\n[backfill:coords] Completado.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[backfill:coords] Error:", err);
    process.exit(1);
  });
