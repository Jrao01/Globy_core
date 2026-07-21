import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  personal: { create: vi.fn(), update: vi.fn() },
  categoria: { delete: vi.fn() },
};

vi.mock("../config/prisma.js", () => ({ default: mockPrisma }));

const { PersonalRegister } = await import("../controllers/PersonalControllers.js");
const { DeleteCategoria } = await import("../controllers/CategoriaControllers.js");

describe("Prisma error P2002 — unique constraint violation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("3.1 correo duplicado devuelve 409 con mensaje específico", async () => {
    mockPrisma.personal.create.mockRejectedValue({
      code: "P2002",
      meta: { target: ["correo"] },
    });

    const req = {
      user: { id: 1, rol: "admin" },
      body: { nombre: "Test", apellido: "User", cedula: "V-1", correo: "existente@test.com", password: "123456" },
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await PersonalRegister(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("Ya existe un registro"),
    }));
  });

  it("3.2 cédula duplicada devuelve 409 con campo específico", async () => {
    mockPrisma.personal.create.mockRejectedValue({
      code: "P2002",
      meta: { target: ["cedula"] },
    });

    const req = {
      user: { id: 1, rol: "admin" },
      body: { nombre: "Test", apellido: "User", cedula: "V-12345", correo: "otro@test.com", password: "123456" },
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await PersonalRegister(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("cedula"),
    }));
  });
});

describe("Prisma error P2003 — foreign key constraint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("3.3 eliminar categoría con productos asociados devuelve 409", async () => {
    mockPrisma.categoria.delete.mockRejectedValue({
      code: "P2003",
    });

    const req = { params: { id: "5" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await DeleteCategoria(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("No se puede eliminar"),
    }));
  });
});
