import { PrismaClient } from './src/generated/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({ url: 'file:./prisma/dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🗑️  Limpiando base de datos...");

  // Delete in reverse dependency order
  await prisma.compraDetalle.deleteMany();
  await prisma.compra.deleteMany();
  await prisma.conexion.deleteMany();
  await prisma.auditoria.deleteMany();
  await prisma.geoIP.deleteMany();
  await prisma.inventario.deleteMany();
  await prisma.ofertaExcepcion.deleteMany();
  await prisma.ofertaSucursal.deleteMany();
  await prisma.oferta.deleteMany();
  await prisma.informeAnalitico.deleteMany();
  await prisma.tasaCambio.deleteMany();
  await prisma.gestionEconomica.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.competidor.deleteMany();
  await prisma.busquedaCompetidor.deleteMany();
  await prisma.competidoresBusqueda.deleteMany();
  await prisma.sucursal.deleteMany();
  await prisma.personal.deleteMany();
  await prisma.tipoPersonal.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.empresaConfig.deleteMany();

  console.log("✅ Base de datos limpiada completamente");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error limpiando DB:", e);
  process.exit(1);
});
