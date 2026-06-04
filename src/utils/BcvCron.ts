import prisma from "../config/prisma.js";
import { updateBcvPrice } from "../services/BcvService.js";

const FREQ_MS: Record<string, number> = {
  "6H": 6 * 60 * 60 * 1000,
  "12H": 12 * 60 * 60 * 1000,
  "24H": 24 * 60 * 60 * 1000,
};

let cronTimer: ReturnType<typeof setInterval> | null = null;

export function startBcvCron(): void {
  if (cronTimer) return;

  cronTimer = setInterval(async () => {
    try {
      const eco = await prisma.gestionEconomica.findFirst();
      if (!eco || !eco.autoUpdate) return;

      const freqMs = FREQ_MS[eco.updateFrequency] ?? 24 * 60 * 60 * 1000;
      const elapsed = Date.now() - (eco.lastUpdate?.getTime() ?? 0);
      if (elapsed >= freqMs) {
        console.log("[BcvCron] Auto-actualizando precio BCV...");
        await updateBcvPrice();
        console.log("[BcvCron] Precio BCV actualizado automáticamente");
      }
    } catch (err) {
      console.error("[BcvCron] Error:", err);
    }
  }, 60_000);

  console.log("[BcvCron] Cron iniciado (verifica cada 60s)");
}

export function stopBcvCron(): void {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
    console.log("[BcvCron] Cron detenido");
  }
}
