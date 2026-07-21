import { describe, it, expect } from "vitest";
import { schemas } from "../middleware/validate.js";

describe("Schema: clienteLogin", () => {
  it("4.1 login sin correo: falla validación", () => {
    const result = schemas.clienteLogin.safeParse({ password: "123456" });
    expect(result.success).toBe(false);
  });

  it("4.2 login sin password: falla validación", () => {
    const result = schemas.clienteLogin.safeParse({ correo: "test@test.com" });
    expect(result.success).toBe(false);
  });

  it("4.3 login con email inválido: falla validación", () => {
    const result = schemas.clienteLogin.safeParse({ correo: "invalido", password: "123" });
    expect(result.success).toBe(false);
  });

  it("login con datos válidos: pasa validación", () => {
    const result = schemas.clienteLogin.safeParse({ correo: "test@test.com", password: "123456" });
    expect(result.success).toBe(true);
  });
});

describe("Schema: createProducto", () => {
  it("4.4 precio negativo: falla validación", () => {
    const result = schemas.createProducto.safeParse({
      nombre: "Prod", tipo: "Físico", precioBase: -5,
      emailProveedor: "prov@test.com", categoriaId: 1,
    });
    expect(result.success).toBe(false);
  });

  it("precio positivo válido: pasa validación", () => {
    const result = schemas.createProducto.safeParse({
      nombre: "Producto Test", tipo: "Físico", precioBase: 25.50,
      emailProveedor: "prov@test.com", categoriaId: 1,
    });
    expect(result.success).toBe(true);
  });
});

describe("Schema: competitorSearch", () => {
  it("4.5 sin categorías: falla validación", () => {
    const result = schemas.competitorSearch.safeParse({
      city: ["Caracas"], maxCrawledPlacesPerSearch: 5,
    });
    expect(result.success).toBe(false);
  });

  it("4.6 con ciudades vacío: falla validación", () => {
    const result = schemas.competitorSearch.safeParse({
      categories: ["Gimnasios"], city: [], maxCrawledPlacesPerSearch: 5,
    });
    expect(result.success).toBe(false);
  });

  it("competitorSearch válido: pasa validación", () => {
    const result = schemas.competitorSearch.safeParse({
      categories: ["Gimnasios"], city: ["Caracas"], maxCrawledPlacesPerSearch: 20,
    });
    expect(result.success).toBe(true);
  });
});

describe("Schema: personalRegister", () => {
  it("password menor a 6 caracteres: falla", () => {
    const result = schemas.personalRegister.safeParse({
      nombre: "Test", apellido: "User", cedula: "V-1",
      correo: "test@test.com", password: "123",
    });
    expect(result.success).toBe(false);
  });

  it("rol inválido: falla", () => {
    const result = schemas.personalRegister.safeParse({
      nombre: "Test", apellido: "User", cedula: "V-1",
      correo: "test@test.com", password: "123456", rol: "superadmin",
    });
    expect(result.success).toBe(false);
  });

  it("personalRegister válido: pasa", () => {
    const result = schemas.personalRegister.safeParse({
      nombre: "Test", apellido: "User", cedula: "V-1",
      correo: "test@test.com", password: "123456", rol: "trabajador",
    });
    expect(result.success).toBe(true);
  });
});

describe("Schema: createOferta", () => {
  it("tipo inválido: falla", () => {
    const result = schemas.createOferta.safeParse({
      nombre: "Oferta", tipo: "descuento", valor: 10,
      fechaInicio: "2026-01-01", fechaFin: "2026-12-31",
      sucursalIds: [1], excepcionIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("createOferta válido: pasa", () => {
    const result = schemas.createOferta.safeParse({
      nombre: "10% OFF", tipo: "porcentaje", valor: 10,
      fechaInicio: "2026-01-01", fechaFin: "2026-12-31",
      sucursalIds: [1], excepcionIds: [],
    });
    expect(result.success).toBe(true);
  });
});
