import { ApifyClient } from 'apify-client';
import type { Competitor, CompetidoresSearch } from "../types/index.js";

export class ApifyService {
    private client = new ApifyClient({
        token: process.env.APIFY_TOKEN,
    });

    async buscar(Filtros: CompetidoresSearch, pais?: string): Promise<Competitor[]> {
        const suffix = pais ? `, ${pais}` : "";
        const ciudades = Filtros.city.map((c) => `${c}${suffix}`);
        console.log(`🔍 Iniciando búsqueda en: ${ciudades.join(", ")}...`);
        const input = {
            searchStringsArray: Filtros.categories,
            locationQuery: ciudades.join(", "),
            maxCrawledPlacesPerSearch: Filtros.maxCrawledPlacesPerSearch,
        }
        const run = await this.client.actor("compass/crawler-google-places").call(input);

        const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

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
            openingHours: item.openingHours,
            orderBy: item.orderBy,
            gasPrices: item.gasPrices,
        }));
    }
}
