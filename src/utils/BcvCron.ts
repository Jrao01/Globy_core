import cron from "node-cron";
import prisma from "../config/prisma.js";
import { updateBcvPrice } from "../services/BcvService.js";

let task: cron.ScheduledTask | null = null;

export function startBcvCron(): void {
  if (task) return;

  task = cron.schedule("0 8,13 * * *", async () => {
    try {
      const eco = await prisma.gestionEconomica.findFirst();
      if (!eco || !eco.autoUpdate) return;
      console.log("[BcvCron] Ejecutando actualización programada (8:00 / 13:00)...");
      await updateBcvPrice();
      console.log("[BcvCron] Tasas actualizadas correctamente");
    } catch (err) {
      console.error("[BcvCron] Error:", err);
    }
  });

  console.log("[BcvCron] Cron iniciado — programado para 8:00 y 13:00 todos los días");
}

export function stopBcvCron(): void {
  if (task) {
    task.stop();
    task = null;
    console.log("[BcvCron] Cron detenido");
  }
}
