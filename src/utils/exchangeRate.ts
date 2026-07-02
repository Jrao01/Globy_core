import prisma from "../config/prisma.js";

export async function getExchangeRates(): Promise<{ usd: number; eur: number }> {
  const [usdTasa, eurTasa] = await Promise.all([
    prisma.tasaCambio.findFirst({ where: { moneda: "USD" }, orderBy: { fecha: "desc" } }),
    prisma.tasaCambio.findFirst({ where: { moneda: "EUR" }, orderBy: { fecha: "desc" } }),
  ]);
  return {
    usd: usdTasa?.precio ?? 1,
    eur: eurTasa?.precio ?? 1,
  };
}

export function convertirABs(precioBase: number, moneda: string, tasas: { usd: number; eur: number }): number {
  const tasa = moneda === "EUR" ? tasas.eur : tasas.usd;
  return Math.round(precioBase * tasa * 100) / 100;
}
