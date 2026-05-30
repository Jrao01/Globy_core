// src/services/ApifyService.ts
import { ApifyClient } from 'apify-client';
import type { Competitor, CompetidoresSearch } from "../types/index.js";

export class ApifyService {
    private client = new ApifyClient({
        token: process.env.APIFY_TOKEN, // Usa variables de entorno en producción
    });

    async buscar(Filtros: CompetidoresSearch): Promise<Competitor[]> {
        console.log(`🔍 Iniciando búsqueda en: ${Filtros.city}...`);
        const input = {
            searchStringsArray: Filtros.categories,
            city: Filtros.city,
            maxCrawledPlacesPerSearch: Filtros.maxCrawledPlacesPerSearch,
            
        }
        const run = await this.client.actor("apify/google-maps-scraper").call(input);

        const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

        // Mapeamos la salida de Apify a nuestra interfaz limpia
        return items.map((item: any) => ({
            id: item.id,
            searchPageUrl: item.searchPageUrl,
            title: item.title,
            subTitle: item.subTitle,
            description: item.description,
            categoryName: item.categoryName,
            categories: item.categories,
            address: item.address,
            neighborhood: item.neighborhood,
            street: item.street,
            city: item.city,
            state: item.state,
            countryCode: item.countryCode,
            location: item.location,
            website: item.website,
            phone: item.phone,
            rank: item.rank,
            placeId: item.placeId,
            fid: item.fid,
            totalScore: item.totalScore,
            reviewsCount: item.reviewsCount,
        }));
    }
}

