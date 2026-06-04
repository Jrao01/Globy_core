import prisma from "../config/prisma.js";

export async function fetchBcvPrice(): Promise<number> {
  const res = await fetch("https://www.bancodevenezuela.com/files/tasas/tasas2.json");
  if (!res.ok) throw new Error(`BCV API responded with ${res.status}`);
  const data: any = await res.json();
  const raw = data?.mesacambio?.bcv?.dolares;
  if (!raw) throw new Error("No se encontró el precio del dólar en la respuesta");
  const price = parseFloat(raw.replace(/\./g, "").replace(",", "."));
  if (isNaN(price)) throw new Error(`Valor inválido: ${raw}`);
  return price;
}

export async function updateBcvPrice(): Promise<{ price: number; saved: boolean }> {
  const price = await fetchBcvPrice();
  let config = await prisma.gestionEconomica.findFirst();
  if (config) {
    await prisma.gestionEconomica.update({
      where: { id: config.id },
      data: { bcvPrice: price, lastUpdate: new Date() },
    });
  } else {
    await prisma.gestionEconomica.create({
      data: { bcvPrice: price, lastUpdate: new Date() },
    });
  }
  return { price, saved: true };
}
