import { PrismaClient } from './src/generated/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' });
const p = new PrismaClient({ adapter });
async function main() {
  try {
    const s = await p.sucursal.count();
    const comp = await p.compra.count();
    const cl = await p.cliente.count();
    const conex = await p.conexion.count();
    const comps = await p.competidor.count();
    const cat = await p.categoria.count();
    const sucs = await p.sucursal.findMany({ take: 5, select: { id: true, nombre: true, ciudad: true } });
    console.log(JSON.stringify({ sucursales: s, compras: comp, clientes: cl, conexiones: conex, competidores: comps, categorias: cat, sucsList: sucs }, null, 2));
  } finally {
    await p.$disconnect();
  }
}
main();
