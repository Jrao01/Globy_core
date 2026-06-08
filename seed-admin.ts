import { PrismaClient } from "./src/generated/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const admin = await prisma.personal.upsert({
    where: { correo: "admin@gmail.com" },
    create: {
      nombre: "Admin",
      apellido: "Principal",
      cedula: "V-00000001",
      correo: "admin@gmail.com",
      password: "admin123",
      rol: "admin",
      status: true,
    },
    update: {},
  });
  console.log("Admin creado/verificado:", admin.correo);

  const worker = await prisma.personal.upsert({
    where: { correo: "trabajador@gmail.com" },
    create: {
      nombre: "Trabajador",
      apellido: "Demo",
      cedula: "V-00000002",
      correo: "trabajador@gmail.com",
      password: "worker123",
      rol: "trabajador",
      status: true,
    },
    update: {},
  });
  console.log("Trabajador creado/verificado:", worker.correo);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
