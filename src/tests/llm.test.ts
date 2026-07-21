import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("LLM_BASE_URL", "http://localhost:11434/v1");
vi.stubEnv("LLM_MODEL", "test-model");

const mockCreate = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };
  }),
}));

describe("LLM Service — generación de insights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("6.1 generarInsightPatrones retorna insight exitosamente", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Pronóstico\nLas ventas muestran una tendencia positiva.\n## Recomendaciones\n1. Incrementar stock." } }],
      usage: { prompt_tokens: 500, completion_tokens: 80 },
    });

    const { generarInsightPatrones } = await import("../services/llmService.js");
    const result = await generarInsightPatrones({
      periodo: { inicio: "2026-01-01", fin: "2026-03-31" },
      descriptiva: { totalVentas: 50000, totalCompras: 150 },
    });

    expect(result).toContain("Pronóstico");
    expect(result).toContain("Recomendaciones");
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test-model",
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user" }),
        ]),
      })
    );
  });

  it("6.2 LLM timeout propaga error", async () => {
    mockCreate.mockRejectedValue(new Error("Request timed out after 300000ms"));

    const { generarInsightPatrones } = await import("../services/llmService.js");
    await expect(generarInsightPatrones({ test: true })).rejects.toThrow("Error en LLM");
  });

  it("6.3 LLM retorna respuesta vacía usa fallback", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const { generarInsightPatrones } = await import("../services/llmService.js");
    const result = await generarInsightPatrones({ test: true });

    expect(result).toBe("No se pudo generar un insight.");
  });

  it("6.4 generarInsightDemanda usa su propio system prompt", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Evaluación de Enfoques\n### Enfoque Concéntrico" } }],
    });

    const { generarInsightDemanda } = await import("../services/llmService.js");
    const result = await generarInsightDemanda({ zonas: [] });

    expect(result).toContain("Evaluación de Enfoques");
    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    const systemMsg = callArgs.messages[0].content;
    expect(systemMsg).toContain("geomarketing");
  });

  it("6.5 generarInsightEquilibrio usa su propio system prompt", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Evaluación de Viabilidad\nOperación saludable." } }],
    });

    const { generarInsightEquilibrio } = await import("../services/llmService.js");
    const result = await generarInsightEquilibrio({ margenBruto: 0.3 });

    expect(result).toContain("Viabilidad");
    const callArgs = mockCreate.mock.calls[0][0];
    const systemMsg = callArgs.messages[0].content;
    expect(systemMsg).toContain("punto de equilibrio");
  });

  /* ─────────── generarInsightRendimiento ─────────── */

  it("6.6 generarInsightRendimiento retorna insight exitosamente", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Análisis de Rendimiento\n## Recomendaciones\n1. Mejorar eficiencia." } }],
      usage: { prompt_tokens: 600, completion_tokens: 90 },
    });

    const { generarInsightRendimiento } = await import("../services/llmService.js");
    const result = await generarInsightRendimiento({
      periodo: { inicio: "2026-01-01", fin: "2026-03-31" },
      kpis: { revenueTotal: 100000, margenBrutoPct: 35 },
    });

    expect(result).toContain("Análisis de Rendimiento");
    expect(result).toContain("Recomendaciones");
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("6.7 generarInsightRendimiento usa su propio system prompt", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Comparativa de Sucursales\nBrecha identificada." } }],
    });

    const { generarInsightRendimiento } = await import("../services/llmService.js");
    await generarInsightRendimiento({ periodo: {}, kpis: {} });

    const callArgs = mockCreate.mock.calls[0][0];
    const systemMsg = callArgs.messages[0].content;
    expect(systemMsg).toContain("Consultor financiero retail");
    expect(systemMsg).toContain("formatoSalida");
  });

  /* ─────────── generarInsightSucursal ─────────── */

  it("6.8 generarInsightSucursal retorna insight exitosamente", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Análisis Operativo\n## Recomendaciones\nReplicar éxito." } }],
    });

    const { generarInsightSucursal } = await import("../services/llmService.js");
    const result = await generarInsightSucursal({
      periodo: { inicio: "2026-01-01", fin: "2026-03-31" },
      resumen: { totalSucursales: 3, mejor: null, peor: null },
    });

    expect(result).toContain("Análisis Operativo");
    expect(result).toContain("Recomendaciones");
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("6.9 generarInsightSucursal usa su propio system prompt", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Riesgos\nAlto riesgo detectado." } }],
    });

    const { generarInsightSucursal } = await import("../services/llmService.js");
    await generarInsightSucursal({});

    const callArgs = mockCreate.mock.calls[0][0];
    const systemMsg = callArgs.messages[0].content;
    expect(systemMsg).toContain("Gerente operaciones retail");
    expect(systemMsg).toContain("recomendacionesOperativas");
  });

  /* ─────────── generarInsightSucursalIndividual ─────────── */

  it("6.10 generarInsightSucursalIndividual retorna insight exitosamente", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Diagnóstico\nMargen neto estable.\n## Acciones\nRevisar precios." } }],
    });

    const { generarInsightSucursalIndividual } = await import("../services/llmService.js");
    const result = await generarInsightSucursalIndividual({
      periodo: { inicio: "2026-01-01", fin: "2026-03-31" },
      sucursal: { nombre: "Sucursal A" },
      kpis: { revenue: "$5000", margenBruto: "35%" },
    });

    expect(result).toContain("Diagnóstico");
    expect(result).toContain("Acciones");
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("6.11 generarInsightSucursalIndividual usa su propio system prompt", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Alertas\nStock bajo." } }],
    });

    const { generarInsightSucursalIndividual } = await import("../services/llmService.js");
    await generarInsightSucursalIndividual({});

    const callArgs = mockCreate.mock.calls[0][0];
    const systemMsg = callArgs.messages[0].content;
    expect(systemMsg).toContain("Auditor rendimiento");
    expect(systemMsg).toContain("sucursal_individual");
  });

  /* ─────────── generarInsightExpansion ─────────── */

  it("6.12 generarInsightExpansion retorna insight exitosamente", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Diagnóstico de Ubicación\nBuena demanda.\n## Recomendación\nABRIR." } }],
    });

    const { generarInsightExpansion } = await import("../services/llmService.js");
    const result = await generarInsightExpansion({
      ubicacion: { latitud: 10.5, longitud: -66.9 },
      demanda: { clientesPotenciales: 500, ticketPromedioEstimado: 45 },
    });

    expect(result).toContain("Diagnóstico de Ubicación");
    expect(result).toContain("Recomendación");
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("6.13 generarInsightExpansion usa su propio system prompt", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Puntuación\nViability score: 75." } }],
    });

    const { generarInsightExpansion } = await import("../services/llmService.js");
    await generarInsightExpansion({ ubicacion: {}, demanda: {} });

    const callArgs = mockCreate.mock.calls[0][0];
    const systemMsg = callArgs.messages[0].content;
    expect(systemMsg).toContain("Consultor viabilidad expansion");
    expect(systemMsg).toContain("puntuacionViabilidad");
  });

  /* ─────────── generarInsightCanibalizacion ─────────── */

  it("6.14 generarInsightCanibalizacion retorna insight exitosamente", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Interpretación Estratégica\nCanibalización baja.\n## Recomendación\nABRIR." } }],
    });

    const { generarInsightCanibalizacion } = await import("../services/llmService.js");
    const result = await generarInsightCanibalizacion({
      ubicacionPropuesta: { lat: 10.5, lng: -66.9 },
      resultado: { canibalizacionPct: 12, tipo: "Defensiva (riesgo bajo)" },
    });

    expect(result).toContain("Interpretación Estratégica");
    expect(result).toContain("Recomendación");
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("6.15 generarInsightCanibalizacion usa su propio system prompt", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "## Interpretación\nRiesgo moderado." } }],
    });

    const { generarInsightCanibalizacion } = await import("../services/llmService.js");
    await generarInsightCanibalizacion({ ubicacionPropuesta: {}, resultado: {} });

    const callArgs = mockCreate.mock.calls[0][0];
    const systemMsg = callArgs.messages[0].content;
    expect(systemMsg).toContain("Estratega expansion retail");
    expect(systemMsg).toContain("canibalizacion");
  });

  /* ─────────── Tests de timeout y fallback para todas las funciones ─────────── */

  it("6.16 generarInsightRendimiento timeout propaga error", async () => {
    mockCreate.mockRejectedValue(new Error("Request timed out"));

    const { generarInsightRendimiento } = await import("../services/llmService.js");
    await expect(generarInsightRendimiento({ test: true })).rejects.toThrow("Error en LLM");
  });

  it("6.17 generarInsightSucursal timeout propaga error", async () => {
    mockCreate.mockRejectedValue(new Error("LLM unavailable"));

    const { generarInsightSucursal } = await import("../services/llmService.js");
    await expect(generarInsightSucursal({ test: true })).rejects.toThrow("Error en LLM");
  });

  it("6.18 generarInsightSucursalIndividual timeout propaga error", async () => {
    mockCreate.mockRejectedValue(new Error("Timeout"));

    const { generarInsightSucursalIndividual } = await import("../services/llmService.js");
    await expect(generarInsightSucursalIndividual({ test: true })).rejects.toThrow("Error en LLM");
  });

  it("6.19 generarInsightExpansion timeout propaga error", async () => {
    mockCreate.mockRejectedValue(new Error("Request timed out"));

    const { generarInsightExpansion } = await import("../services/llmService.js");
    await expect(generarInsightExpansion({ test: true })).rejects.toThrow("Error en LLM");
  });

  it("6.20 generarInsightCanibalizacion timeout propaga error", async () => {
    mockCreate.mockRejectedValue(new Error("Request timed out"));

    const { generarInsightCanibalizacion } = await import("../services/llmService.js");
    await expect(generarInsightCanibalizacion({ test: true })).rejects.toThrow("Error en LLM");
  });

  it("6.21 generarInsightRendimiento null content usa fallback", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const { generarInsightRendimiento } = await import("../services/llmService.js");
    const result = await generarInsightRendimiento({ test: true });

    expect(result).toBe("No se pudo generar un insight.");
  });

  it("6.22 generarInsightSucursal null content usa fallback", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const { generarInsightSucursal } = await import("../services/llmService.js");
    const result = await generarInsightSucursal({ test: true });

    expect(result).toBe("No se pudo generar un insight.");
  });

  it("6.23 generarInsightSucursalIndividual null content usa fallback", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const { generarInsightSucursalIndividual } = await import("../services/llmService.js");
    const result = await generarInsightSucursalIndividual({ test: true });

    expect(result).toBe("No se pudo generar un insight.");
  });

  it("6.24 generarInsightExpansion null content usa fallback", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const { generarInsightExpansion } = await import("../services/llmService.js");
    const result = await generarInsightExpansion({ test: true });

    expect(result).toBe("No se pudo generar un insight.");
  });

  it("6.25 generarInsightCanibalizacion null content usa fallback", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const { generarInsightCanibalizacion } = await import("../services/llmService.js");
    const result = await generarInsightCanibalizacion({ test: true });

    expect(result).toBe("No se pudo generar un insight.");
  });
});
