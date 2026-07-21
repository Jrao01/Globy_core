import "dotenv/config";

process.env.JWT_SECRET = "test_secret_key_for_jwt_signing";
process.env.DATABASE_URL = "file:./prisma/test.db";
process.env.APIFY_TOKEN = "test_apify_token";
process.env.LLM_BASE_URL = "http://localhost:11434/v1";
process.env.LLM_MODEL = "test-model";

vi.mock("../config/prisma.js", () => {
  const mPrisma = {
    personal: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    cliente: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    sucursal: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    competidor: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    busquedaCompetidor: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    competidoresBusqueda: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    categoria: {
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    producto: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    compra: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    conexion: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    gestorEconomica: {
      findFirst: vi.fn(),
    },
    tasaCambio: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    empresaConfig: {
      findFirst: vi.fn(),
    },
    informeAnalitico: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    auditoria: {
      create: vi.fn(),
    },
    geoIP: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    oferta: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn((fn: any) => fn(mPrisma)),
  };
  return { default: mPrisma };
});
