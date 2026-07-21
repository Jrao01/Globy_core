import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = "test_secret_key_for_jwt_signing";

export function generateToken(payload: { id: number; rol: string; correo?: string; sucursalId?: number }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

export function createMockCompetitor(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    placeId: "ChIJ12345",
    title: "Competidor Test",
    city: "Caracas",
    address: "Calle Principal",
    location: { lat: 10.5, lng: -66.9 },
    totalScore: 4.5,
    reviewsCount: 100,
    categoryName: "Gimnasio",
    categories: ["Gimnasio", "Fitness"],
    website: "https://test.com",
    phone: "+58 412 123 4567",
    ...overrides,
  };
}

export function createMockUser(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    nombre: "Admin",
    apellido: "Test",
    cedula: "V-12345678",
    correo: "admin@test.com",
    password: "$2b$10$hashedpassword",
    rol: "admin",
    status: true,
    sucursalId: 1,
    telefono: null,
    tipoPersonalId: null,
    sueldoMensual: null,
    createdAt: new Date(),
    sucursal: { id: 1, nombre: "Sucursal Principal" },
    ...overrides,
  };
}

export function mockAuthMiddleware(req: Partial<Request>, user: { id: number; rol: string; correo?: string; sucursalId?: number }): void {
  (req as any).user = user;
}

export function createMockResponse() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}
