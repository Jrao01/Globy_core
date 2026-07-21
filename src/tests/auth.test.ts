import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { AuthRequest, JwtPayload } from "../types/index.js";

const mockPrisma = {
  personal: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("../config/prisma.js", () => ({ default: mockPrisma }));

const { loginPersonal, registerPersonal } = await import("../services/PersonalService.js");
const { verifyToken, verifyRole } = await import("../middleware/authMiddleware.js");
const { LogInPersonal, PersonalRegister } = await import("../controllers/PersonalControllers.js");

describe("PersonalService — loginPersonal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1.1 login exitoso con admin", async () => {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    mockPrisma.personal.findUnique.mockResolvedValue({
      id: 1, nombre: "Admin", correo: "admin@test.com",
      password: hashedPassword, rol: "admin", status: true,
      sucursalId: 1, sucursal: { id: 1, nombre: "Principal" },
    });

    const result = await loginPersonal("admin@test.com", "admin123");

    expect(result.user).toBeDefined();
    expect(result.user.correo).toBe("admin@test.com");
    expect(result.user.rol).toBe("admin");
    expect((result.user as any).password).toBeUndefined();
    expect(result.token).toBeDefined();
    const decoded = jwt.verify(result.token, "test_secret_key_for_jwt_signing") as JwtPayload;
    expect(decoded.rol).toBe("admin");
  });

  it("1.2 login con correo inexistente", async () => {
    mockPrisma.personal.findUnique.mockResolvedValue(null);
    await expect(loginPersonal("noexiste@test.com", "admin123")).rejects.toThrow("INVALID_CREDENTIALS");
  });

  it("1.3 login con password incorrecto", async () => {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    mockPrisma.personal.findUnique.mockResolvedValue({
      id: 1, correo: "admin@test.com", password: hashedPassword, rol: "admin",
    });
    await expect(loginPersonal("admin@test.com", "wrongpassword")).rejects.toThrow("INVALID_CREDENTIALS");
  });

  it("1.4 login con correo vacío", async () => {
    mockPrisma.personal.findUnique.mockResolvedValue(null);
    await expect(loginPersonal("", "admin123")).rejects.toThrow("INVALID_CREDENTIALS");
  });
});

describe("verifyToken middleware", () => {
  it("1.5 sin header Authorization", () => {
    const req = { headers: {} } as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Acceso denegado. Token no proporcionado." });
    expect(next).not.toHaveBeenCalled();
  });

  it("1.6 token malformado (Bearer sin token)", () => {
    const req = { headers: { authorization: "Bearer " } } as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Token malformado." });
    expect(next).not.toHaveBeenCalled();
  });

  it("1.7 token inválido/expirado", () => {
    const req = { headers: { authorization: "Bearer token_invalido" } } as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Token inválido o expirado." });
    expect(next).not.toHaveBeenCalled();
  });

  it("1.8 token válido llama next() y setea req.user", () => {
    const token = jwt.sign({ id: 1, rol: "admin" }, "test_secret_key_for_jwt_signing", { expiresIn: "1h" });
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    verifyToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user?.rol).toBe("admin");
    expect(req.user?.id).toBe(1);
  });
});

describe("verifyRole middleware", () => {
  it("1.9 rol permitido llama next()", () => {
    const req = { user: { id: 1, rol: "admin" } } as AuthRequest;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    const middleware = verifyRole("admin", "gerente");
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("1.10 rol no permitido devuelve 403", () => {
    const req = { user: { id: 2, rol: "trabajador" } } as AuthRequest;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    const middleware = verifyRole("admin", "gerente");
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "No tiene permisos para acceder a este recurso." });
    expect(next).not.toHaveBeenCalled();
  });

  it("1.11 usuario no autenticado devuelve 401", () => {
    const req = { user: undefined } as AuthRequest;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    const middleware = verifyRole("admin");
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "No autenticado." });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("LogInPersonal controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1.12 login exitoso devuelve 200 con token", async () => {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    mockPrisma.personal.findUnique.mockResolvedValue({
      id: 1, nombre: "Admin", correo: "admin@test.com",
      password: hashedPassword, rol: "admin", status: true,
      sucursalId: 1, telefono: null, createdAt: new Date(),
      sucursal: { id: 1, nombre: "Principal" },
    });

    const req = { body: { correo: "admin@test.com", password: "admin123" } } as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;

    await LogInPersonal(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Login exitoso",
        data: expect.objectContaining({ correo: "admin@test.com" }),
        token: expect.any(String),
      })
    );
  });

  it("1.13 login fallido devuelve 401", async () => {
    mockPrisma.personal.findUnique.mockResolvedValue(null);
    const req = { body: { correo: "noexiste@test.com", password: "x" } } as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;

    await LogInPersonal(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Credenciales inválidas" });
  });
});

describe("PersonalRegister controller — Prisma error P2002", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1.14 correo duplicado devuelve 409", async () => {
    mockPrisma.personal.create.mockRejectedValue({
      code: "P2002",
      meta: { target: ["correo"] },
    });

    const req = {
      user: { id: 1, rol: "admin" },
      body: { nombre: "Test", apellido: "User", cedula: "V-1", correo: "dup@test.com", password: "123456" },
    } as AuthRequest;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;

    await PersonalRegister(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("Ya existe") })
    );
  });
});
