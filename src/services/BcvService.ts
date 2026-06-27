import prisma from "../config/prisma.js";

export async function fetchBcvPrices(): Promise<{ usd: number; eur: number }> {
  const res = await fetch("https://www.bancodevenezuela.com/files/tasas/tasas2.json");
  if (!res.ok) throw new Error(`BCV API responded with ${res.status}`);
  const data: any = await res.json();
  const rawUsd = data?.mesacambio?.bcv?.dolares;
  const rawEur = data?.mesacambio?.bcv?.euros;
  if (!rawUsd) throw new Error("No se encontró el precio del dólar en la respuesta");
  if (!rawEur) throw new Error("No se encontró el precio del euro en la respuesta");
  const parsePrice = (raw: string) => parseFloat(raw.replace(/\./g, "").replace(",", "."));
  const usd = parsePrice(rawUsd);
  const eur = parsePrice(rawEur);
  if (isNaN(usd) || isNaN(eur)) throw new Error(`Valores inválidos: USD=${rawUsd}, EUR=${rawEur}`);
  return { usd, eur };
}

export async function updateBcvPrice(): Promise<{ usd: number; eur: number; saved: boolean }> {
  const { usd, eur } = await fetchBcvPrices();
  await prisma.tasaCambio.create({ data: { moneda: "USD", precio: usd } });
  await prisma.tasaCambio.create({ data: { moneda: "EUR", precio: eur } });
  return { usd, eur, saved: true };
}
