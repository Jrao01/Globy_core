import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CompetidoresSearch } from "../types/index.js";

const mockActorCall = vi.fn();
const mockListItems = vi.fn();

vi.mock("apify-client", () => ({
  ApifyClient: vi.fn().mockImplementation(() => ({
    actor: vi.fn().mockReturnValue({
      call: mockActorCall,
    }),
    dataset: vi.fn().mockReturnValue({
      listItems: mockListItems,
    }),
  })),
}));

const mockPrisma = {
  busquedaCompetidor: { upsert: vi.fn() },
  competidoresBusqueda: { deleteMany: vi.fn(), create: vi.fn() },
  competidor: { upsert: vi.fn() },
  empresaConfig: { findFirst: vi.fn() },
  $transaction: vi.fn((fn: any) => fn(mockPrisma)),
};

vi.mock("../config/prisma.js", () => ({ default: mockPrisma }));

const { ApifyService } = await import("../services/CompetitorsService.js");
const { SearchCompetitors } = await import("../controllers/CompetitorControllers.js");

describe("ApifyService — buscar competidores", () => {
  let service: ApifyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ApifyService();
  });

  it("2.1 búsqueda exitosa devuelve array mapeado", async () => {
    mockActorCall.mockResolvedValue({ defaultDatasetId: "dataset-123" });
    mockListItems.mockResolvedValue({
      items: [
        { title: "Gimnasio A", placeId: "ChIJA", city: "Caracas", address: "Calle 1", location: { lat: 10.5, lng: -66.9 }, totalScore: 4.5, reviewsCount: 50, categoryName: "Gimnasio", categories: ["Gimnasio"], website: "https://a.com", phone: "+58 412 111 2233" },
        { title: "Gimnasio B", placeId: "ChIJB", city: "Caracas", address: "Calle 2", location: { lat: 10.6, lng: -66.8 }, totalScore: 4.0, reviewsCount: 30, categoryName: "Gimnasio", categories: ["Gimnasio"], website: "https://b.com", phone: null },
      ],
    });

    const filtros: CompetidoresSearch = { categories: ["Gimnasios"], city: ["Caracas"], maxCrawledPlacesPerSearch: 5 };
    const results = await service.buscar(filtros, "Venezuela");

    expect(results).toHaveLength(2);
    expect(results[0].title).toBe("Gimnasio A");
    expect(results[0].placeId).toBe("ChIJA");
    expect(results[0].totalScore).toBe(4.5);
    expect(results[0].phone).toBe("+58 412 111 2233");
  });

  it("2.2 Apify lanza error (sin créditos)", async () => {
    mockActorCall.mockRejectedValue(new Error("Not enough credits. Please top up your account."));

    const filtros: CompetidoresSearch = { categories: ["Gimnasios"], city: ["Caracas"], maxCrawledPlacesPerSearch: 5 };
    await expect(service.buscar(filtros)).rejects.toThrow("Not enough credits");
  });

  it("2.3 resultados vacíos", async () => {
    mockActorCall.mockResolvedValue({ defaultDatasetId: "dataset-456" });
    mockListItems.mockResolvedValue({ items: [] });

    const filtros: CompetidoresSearch = { categories: ["Gimnasios"], city: ["Caracas"], maxCrawledPlacesPerSearch: 5 };
    const results = await service.buscar(filtros);

    expect(results).toHaveLength(0);
  });

  it("2.4 campos faltantes no causan crash", async () => {
    mockActorCall.mockResolvedValue({ defaultDatasetId: "dataset-789" });
    mockListItems.mockResolvedValue({
      items: [{ title: "Sin datos" }],
    });

    const filtros: CompetidoresSearch = { categories: ["Gimnasios"], city: ["Caracas"], maxCrawledPlacesPerSearch: 5 };
    const results = await service.buscar(filtros);

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Sin datos");
    expect(results[0].placeId).toBeUndefined();
    expect(results[0].totalScore).toBeUndefined();
  });
});

describe("SearchCompetitors controller — validaciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("2.5 búsqueda sin categorías devuelve 400", async () => {
    const req = { body: { city: ["Caracas"], maxCrawledPlacesPerSearch: 5 } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await SearchCompetitors(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Debe especificar al menos una categoría y una ciudad" });
  });

  it("2.6 búsqueda sin ciudades devuelve 400", async () => {
    const req = { body: { categories: ["Gimnasios"], city: [], maxCrawledPlacesPerSearch: 5 } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await SearchCompetitors(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Debe especificar al menos una categoría y una ciudad" });
  });

  it("2.7 error de Apify devuelve 500 con mensaje", async () => {
    mockActorCall.mockRejectedValue(new Error("API rate limit exceeded"));

    const req = { body: { categories: ["Gimnasios"], city: ["Caracas"], maxCrawledPlacesPerSearch: 5 } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await SearchCompetitors(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "API rate limit exceeded" })
    );
  });
});
