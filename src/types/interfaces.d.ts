import type { Cliente } from "../generated/models.js";

export type RegisterType = Omit<Cliente, 'id' | 'createdAt' | 'tipoCliente'>;

export type LoginType = Pick<Cliente, 'correo' | 'password'>;

export interface Competitor {
    id: number;
    searchPageUrl: string;
    title: string;
    subTitle: string;
    description: string;
    categoryName: string;
    categories: string[];       
    address: string;
    neighborhood: string;
    street: string;
    city: string;
    state: string;
    countryCode: string;
    location: {
        lat: number;
        lng: number;
    };
    website: string;
    phone: string;
    rank: number;
    placeId: string;
    fid: string;
    totalScore: number;
    reviewsCount: number;
    openingHours?: {
        day: string;
        hours: string;
    }[];
    orderBy?: string[];
    gasPrices?: string[];
}

export interface CompetidoresSearch {
    categories: string[];
    city: string[];
    maxCrawledPlacesPerSearch: number;
}


