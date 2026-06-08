import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
