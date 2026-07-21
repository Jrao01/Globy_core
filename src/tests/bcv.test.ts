import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  tasaCambio: { create: vi.fn() },
  gestionEconomica: { findFirst: vi.fn() },
};

vi.mock("../config/prisma.js", () => ({ default: mockPrisma }));

describe("fetchBcvPrices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("5.1 respuesta exitosa parsea USD y EUR correctamente", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        mesacambio: { bcv: { dolares: "56,78", euros: "61,45" } },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { fetchBcvPrices } = await import("../services/BcvService.js");
    const result = await fetchBcvPrices();

    expect(result.usd).toBe(56.78);
    expect(result.eur).toBe(61.45);
  });

  it("5.2 fetch falla por error de red", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const { fetchBcvPrices } = await import("../services/BcvService.js");
    await expect(fetchBcvPrices()).rejects.toThrow("Network error");
  });

  it("5.3 HTTP error 503 lanza error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const { fetchBcvPrices } = await import("../services/BcvService.js");
    await expect(fetchBcvPrices()).rejects.toThrow("BCV API responded with 503");
  });

  it("5.4 valores malformados lanzan error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mesacambio: { bcv: { dolares: "1,2.3.4", euros: "abc" } } }),
    }));

    const { fetchBcvPrices } = await import("../services/BcvService.js");
    await expect(fetchBcvPrices()).rejects.toThrow("Valores inválidos");
  });

  it("updateBcvPrice persiste ambas tasas en DB", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mesacambio: { bcv: { dolares: "80,50", euros: "90,00" } } }),
    }));

    const { updateBcvPrice } = await import("../services/BcvService.js");
    const result = await updateBcvPrice();

    expect(result.usd).toBe(80.50);
    expect(result.eur).toBe(90.00);
    expect(result.saved).toBe(true);
    expect(mockPrisma.tasaCambio.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.tasaCambio.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { moneda: "USD", precio: 80.50 } })
    );
    expect(mockPrisma.tasaCambio.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { moneda: "EUR", precio: 90.00 } })
    );
  });
});
