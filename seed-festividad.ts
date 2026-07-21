import { PrismaClient } from "./src/generated/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});

const prisma = new PrismaClient({ adapter });

const COEFICIENTES = [
  { mes: 1,  coeficienteConsumoMasivo: 0.85, coeficienteTecnologia: 0.45, coeficienteRopa: 0.40, coeficienteRestaurantes: 0.70, coeficientePromedio: 0.60 },
  { mes: 2,  coeficienteConsumoMasivo: 0.90, coeficienteTecnologia: 0.55, coeficienteRopa: 0.60, coeficienteRestaurantes: 0.90, coeficientePromedio: 0.74 },
  { mes: 3,  coeficienteConsumoMasivo: 0.95, coeficienteTecnologia: 0.65, coeficienteRopa: 0.70, coeficienteRestaurantes: 0.95, coeficientePromedio: 0.81 },
  { mes: 4,  coeficienteConsumoMasivo: 1.00, coeficienteTecnologia: 0.75, coeficienteRopa: 0.80, coeficienteRestaurantes: 1.05, coeficientePromedio: 0.90 },
  { mes: 5,  coeficienteConsumoMasivo: 1.00, coeficienteTecnologia: 0.90, coeficienteRopa: 1.00, coeficienteRestaurantes: 1.10, coeficientePromedio: 1.00 },
  { mes: 6,  coeficienteConsumoMasivo: 1.05, coeficienteTecnologia: 0.85, coeficienteRopa: 0.90, coeficienteRestaurantes: 1.00, coeficientePromedio: 0.95 },
  { mes: 7,  coeficienteConsumoMasivo: 1.05, coeficienteTecnologia: 0.80, coeficienteRopa: 0.95, coeficienteRestaurantes: 1.20, coeficientePromedio: 1.00 },
  { mes: 8,  coeficienteConsumoMasivo: 1.00, coeficienteTecnologia: 0.70, coeficienteRopa: 1.25, coeficienteRestaurantes: 1.30, coeficientePromedio: 1.06 },
  { mes: 9,  coeficienteConsumoMasivo: 0.95, coeficienteTecnologia: 0.65, coeficienteRopa: 1.15, coeficienteRestaurantes: 0.85, coeficientePromedio: 0.90 },
  { mes: 10, coeficienteConsumoMasivo: 1.00, coeficienteTecnologia: 1.00, coeficienteRopa: 1.00, coeficienteRestaurantes: 1.00, coeficientePromedio: 1.00 },
  { mes: 11, coeficienteConsumoMasivo: 1.15, coeficienteTecnologia: 1.80, coeficienteRopa: 1.60, coeficienteRestaurantes: 1.20, coeficientePromedio: 1.44 },
  { mes: 12, coeficienteConsumoMasivo: 1.45, coeficienteTecnologia: 2.10, coeficienteRopa: 2.70, coeficienteRestaurantes: 1.60, coeficientePromedio: 1.96 },
];

async function main() {
  console.log("🌱 Cargando coeficientes de estacionalidad...\n");

  for (const c of COEFICIENTES) {
    await prisma.coeficienteFestividad.upsert({
      where: { mes: c.mes },
      create: c,
      update: {
        coeficienteConsumoMasivo: c.coeficienteConsumoMasivo,
        coeficienteTecnologia: c.coeficienteTecnologia,
        coeficienteRopa: c.coeficienteRopa,
        coeficienteRestaurantes: c.coeficienteRestaurantes,
        coeficientePromedio: c.coeficientePromedio,
      },
    });
    const mesNombres = [
      "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    console.log(`  ✓ ${mesNombres[c.mes]}: promedio=${c.coeficientePromedio}`);
  }

  console.log("\n✅ 12 coeficientes de estacionalidad cargados");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
