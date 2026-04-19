import { PrismaClient } from "@prisma/client";

async function main() {
  console.log("Starting Prisma test with log option...");
  try {
    const prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
    console.log("Prisma instance created.");
    await prisma.$connect();
    console.log("Prisma connected successfully!");
    await prisma.$disconnect();
  } catch (err: any) {
    console.error("Prisma failed to initialize:");
    console.error(err.message);
    if (err.stack) console.error(err.stack);
  }
}

main();
