// test-apify.ts
import { ApifyService } from '../services/CompetitorsService.js';
import type { CompetidoresSearch } from '../types/index.js';
async function main() {
    const service = new ApifyService();

    try {
        const filtros: CompetidoresSearch = { categories: ["Gimnasios"], city: ["San Juan de los Morros"], maxCrawledPlacesPerSearch: 5 };
        const resultados = await service.buscar(filtros);

            console.log("✅ Datos recibidos de Apify:");
        console.dir(resultados, { depth: null }); // Imprime el objeto completo

    } catch (error) {
        console.error("❌ Falló la conexión con Apify:", error);
    }
}

main();