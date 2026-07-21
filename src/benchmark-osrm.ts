import { getDrivingDistance } from "./services/RoutingService.js";

const ORIGEN = { lat: 10.4806, lng: -66.9036 }; // Caracas centro
const DESTINOS = Array.from({ length: 100 }, (_, i) => ({
  lat: 10.45 + Math.random() * 0.1,
  lng: -66.92 + Math.random() * 0.1,
}));

async function main() {
  console.log(`Calculando ${DESTINOS.length} rutas a OSRM local (${process.env.OSRM_BASE || "http://localhost:5000"})...`);
  const inicio = Date.now();

  const resultados = await Promise.allSettled(
    DESTINOS.map((d) => getDrivingDistance(ORIGEN.lat, ORIGEN.lng, d.lat, d.lng))
  );

  const fin = Date.now();
  const exitosos = resultados.filter((r) => r.status === "fulfilled").length;
  const fallidos = resultados.filter((r) => r.status === "rejected").length;

  const duraciones = resultados
    .filter((r) => r.status === "fulfilled")
    .map((r: any) => r.value.duracionMinutos)
    .sort((a: number, b: number) => a - b);

  const distancias = resultados
    .filter((r) => r.status === "fulfilled")
    .map((r: any) => r.value.distanciaKm)
    .sort((a: number, b: number) => a - b);

  console.log(`
Resultados:
  - Tiempo total: ${((fin - inicio) / 1000).toFixed(2)}s
  - Exitosos: ${exitosos}
  - Fallidos: ${fallidos}
  - Promedio: ${((fin - inicio) / DESTINOS.length).toFixed(2)}ms por ruta
  - Duración min: ${duraciones[0]?.toFixed(1) || "-"} min
  - Duración max: ${duraciones[duraciones.length - 1]?.toFixed(1) || "-"} min
  - Distancia min: ${distancias[0]?.toFixed(1) || "-"} km
  - Distancia max: ${distancias[distancias.length - 1]?.toFixed(1) || "-"} km
  - Throughput: ${(exitosos / ((fin - inicio) / 1000)).toFixed(1)} rutas/segundo
  `);
}

main();
