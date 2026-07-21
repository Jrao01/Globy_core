import "dotenv/config";
import { PrismaClient } from "./src/generated/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcrypt";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});

const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 10;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min: number, max: number) { return Math.round((min + Math.random() * (max - min)) * 100) / 100; }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function retryWithFallback<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await fn();
      console.log(`  ✓ ${name} — obtenido de API`);
      return result;
    } catch (err: any) {
      console.log(`  ⚠ ${name} — intento ${attempt}/${MAX_RETRIES} falló: ${err.message}`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }
  console.log(`  ⚠ ${name} — usando datos de ejemplo`);
  return fallback;
}

/* ─────────────────── Fetch: Tasas BCV ─────────────────── */
async function fetchBCVRates(): Promise<{ usd: number; eur: number }> {
  const res = await fetch("https://www.bancodevenezuela.com/files/tasas/tasas2.json", {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`BCV HTTP ${res.status}`);
  const data: any = await res.json();
  const rawUsd = data?.mesacambio?.bcv?.dolares;
  const rawEur = data?.mesacambio?.bcv?.euros;
  if (!rawUsd || !rawEur) throw new Error("BCV: campos faltantes");
  const parsePrice = (raw: string) => parseFloat(raw.replace(/\./g, "").replace(",", "."));
  const usd = parsePrice(rawUsd);
  const eur = parsePrice(rawEur);
  if (isNaN(usd) || isNaN(eur)) throw new Error(`BCV: valores inválidos USD=${rawUsd} EUR=${rawEur}`);
  return { usd, eur };
}

/* ─────────────────── Fetch: Ciudades Venezuela (GeoDB) ─────────────────── */
interface GeoDBCity { nombre: string; region: string; poblacion: number; latitud: number; longitud: number; }

async function fetchTopCiudades(): Promise<GeoDBCity[]> {
  const url = "https://geodb-free-service.wirefreethought.com/v1/geo/cities?countryIds=VE&types=CITY&sort=-population&limit=10";
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`GeoDB HTTP ${res.status}`);
  const data = await res.json() as any;
  if (!data.data?.length) throw new Error("GeoDB: sin datos");
  return data.data.map((c: any) => ({
    nombre: c.name, region: c.region, poblacion: c.population, latitud: c.latitude, longitud: c.longitude,
  }));
}

/* ─────────────────── Fetch: Competidores Apify ─────────────────── */
interface CompetitorData {
  placeId: string; nombre: string; ciudad: string; direccion: string;
  coordenadasLat: number; coordenadasLng: number; cantReviews: number;
  ratingPromedio: number | null; tipoNegocio: string | null; categories: string;
  website: string | null; phone: string | null;
}

async function fetchCompetidores(city: string, cats: string[]): Promise<CompetitorData[]> {
  const { ApifyClient } = await import("apify-client");
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const input = {
    searchStringsArray: cats,
    locationQuery: `${city}, Venezuela`,
    maxCrawledPlacesPerSearch: 10,
  };
  const run = await client.actor("compass/crawler-google-places").call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items
    .filter((item: any) => item.placeId)
    .map((item: any) => ({
      placeId: item.placeId,
      nombre: item.title || "Sin nombre",
      ciudad: item.city || city,
      direccion: item.address || "",
      coordenadasLat: item.location?.lat ?? 0,
      coordenadasLng: item.location?.lng ?? 0,
      cantReviews: item.reviewsCount ?? 0,
      ratingPromedio: item.totalScore ?? null,
      tipoNegocio: item.categoryName ?? null,
      categories: JSON.stringify(item.categories ?? []),
      website: item.website ?? null,
      phone: item.phone ?? null,
    }));
}

/* ─────────────────── COEFICIENTES ─────────────────── */
const COEFICIENTES = [
  { mes: 1,  coeficienteConsumoMasivo: 0.85, coeficienteTecnologia: 0.45, coeficienteRopa: 0.40, coeficienteRestaurantes: 0.70, coeficientePromedio: 0.60 },
  { mes: 2,  coeficienteConsumoMasivo: 0.90, coeficienteTecnologia: 0.55, coeficienteRopa: 0.60, coeficienteRestaurantes: 0.90, coeficientePromedio: 0.74 },
  { mes: 3,  coeficienteConsumoMasivo: 0.95, coeficienteTecnologia: 0.65, coeficienteRopa: 0.70, coeficienteRestaurantes: 0.95, coeficientePromedio: 0.81 },
  { mes: 4,  coeficienteConsumoMasivo: 1.00, coeficienteTecnologia: 0.75, coeficienteRopa: 0.80, coeficienteRestaurantes: 1.05, coeficientePromedio: 0.90 },
  { mes: 5,  coeficienteConsumoMasivo: 1.00, coeficienteTecnologia: 0.90, coeficienteRopa: 1.00, coeficienteRestaurantes: 1.10, coeficientePromedio: 1.00 },
  { mes: 6,  coeficienteConsumoMasivo: 1.05, coeficienteTecnologia: 0.85, coeficienteRopa: 0.90, coeficienteRestaurantes: 1.00, coeficientePromedio: 0.95 },
  { mes: 7,  coeficienteConsumoMasivo: 1.05, coeficienteTecnologia: 0.80, coeficienteRopa: 0.95, coeficienteRestaurantes: 1.20, coeficientePromedio: 1.00 },
  { mes: 8,  coeficienteConsumoMasivo: 1.00, coeficienteTecnologia: 0.70, coeficienteRopa: 1.25, coeficienteRestaurantes: 1.30, coeficientePromedio: 1.06 },
  { mes: 9,  coeficienteConsumoMasivo: 0.95, coeficienteTecnologia: 0.65, coeficienteRopa: 1.15, coeficienteRestaurantes: 0.85, coeficientePromedio: 0.90 },
  { mes: 10, coeficienteConsumoMasivo: 1.00, coeficienteTecnologia: 1.00, coeficienteRopa: 1.00, coeficienteRestaurantes: 1.00, coeficientePromedio: 1.00 },
  { mes: 11, coeficienteConsumoMasivo: 1.15, coeficienteTecnologia: 1.80, coeficienteRopa: 1.60, coeficienteRestaurantes: 1.20, coeficientePromedio: 1.44 },
  { mes: 12, coeficienteConsumoMasivo: 1.45, coeficienteTecnologia: 2.10, coeficienteRopa: 2.70, coeficienteRestaurantes: 1.60, coeficientePromedio: 1.96 },
];

/* ─────────────────── MAIN ─────────────────── */
async function main() {
  console.log("💪 Seed FitZone — Fitness y Deportes\n");

  // ── Auto-clear ──
  const tables = [
    'Mensaje', 'Chat', 'UbicacionLog', 'CompraDetalle', 'Compra',
    'Inventario', 'OfertaExcepcion', 'OfertaSucursal', 'Oferta',
    'CompetidoresBusqueda', 'BusquedaCompetidor', 'Competidor',
    'Sucursal', 'InformeAnalitico', 'Auditoria', 'GeoIP',
    'Conexion', 'TipoPersonal', 'Personal', 'Cliente',
    'CategoriaSinergia', 'Categoria', 'Producto',
    'GestionEconomica', 'TasaCambio', 'EmpresaConfig',
    'CiudadPoblacion', 'CoeficienteFestividad'
  ];
  for (const t of tables) {
    try { await prisma.$executeRawUnsafe(`DELETE FROM "${t}"`); } catch {}
  }
  console.log("✓ Base de datos limpiada\n");

  // ── EmpresaConfig ──
  await prisma.empresaConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1, nombreEmpresa: "FitZone", rif: "J-60606060-6",
      direccionFiscal: "Av. Bolívar Norte, CC Metropolitano, Nivel 2, Valencia",
      telefono: "+58-241-555-6060", logoUrl: null, pais: "Venezuela",
      colorPrimario: "#2ec4b6", bannerImg: null,
      bannerTitle: "FitZone",
      bannerSubtitle: "Todo para tu entrenamiento — equipa tu mejor versión",
      smtpHost: "smtp.gmail.com", smtpPort: 587, smtpUser: "zhetajamer@gmail.com", smtpPass: "kmxhhlooitcmelhq",
      costoPorKm: 0.33, precioMinimoEntrega: 1.00,
      pagoMovilBanco: "0102", pagoMovilCedulaTipo: "V",
      pagoMovilCedula: "30336715", pagoMovilTelefono: "04128807038",
    },
    update: {
      smtpHost: "smtp.gmail.com", smtpPort: 587, smtpUser: "zhetajamer@gmail.com", smtpPass: "kmxhhlooitcmelhq",
      costoPorKm: 0.33, precioMinimoEntrega: 1.00,
      pagoMovilBanco: "0102", pagoMovilCedulaTipo: "V",
      pagoMovilCedula: "30336715", pagoMovilTelefono: "04128807038",
    },
  });
  console.log("✓ EmpresaConfig — FitZone");

  // ── GestionEconomica ──
  await prisma.gestionEconomica.upsert({
    where: { id: 1 },
    create: { id: 1, monedaPrincipal: "USD", autoUpdate: true },
    update: {},
  });
  console.log("✓ GestionEconomica");

  // ── Tasas de Cambio — BCV API real ──
  const bcvFallback = { usd: 60, eur: 65 };
  const bcvRates = await retryWithFallback("Tasas BCV (USD/EUR)", fetchBCVRates, bcvFallback);

  const now = new Date();
  for (let m = 5; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 15);
    const variance = m === 0 ? 1 : 1 + (Math.random() * 0.06 - 0.03);
    await prisma.tasaCambio.create({ data: { moneda: "USD", precio: Math.round(bcvRates.usd * variance * 100) / 100, fecha: d } });
    await prisma.tasaCambio.create({ data: { moneda: "EUR", precio: Math.round(bcvRates.eur * variance * 100) / 100, fecha: d } });
  }
  console.log(`✓ Tasas de Cambio (12 registros, USD=${bcvRates.usd}, EUR=${bcvRates.eur})`);

  // ── Sucursales ──
  const sucursalesData = [
    { nombre: "FitZone Valencia", ciudad: "Valencia", direccion: "Av. Bolívar Norte, CC Metropolitano, Nivel 2", coordenadasLat: 10.1621, coordenadasLng: -68.0024, tipo: "principal" },
    { nombre: "FitZone San Diego", ciudad: "San Diego", direccion: "Av. Principal de San Diego, CC San Diego, Local 12", coordenadasLat: 10.2450, coordenadasLng: -67.9800, tipo: "secundaria" },
    { nombre: "FitZone Naguanagua", ciudad: "Naguanagua", direccion: "Av. Universidad, CC Viva Naguanagua, Nivel 1", coordenadasLat: 10.2800, coordenadasLng: -68.0200, tipo: "secundaria" },
  ];
  const sucursales: { id: number; ciudad: string; nombre: string }[] = [];
  for (const s of sucursalesData) {
    const created = await prisma.sucursal.create({ data: s });
    sucursales.push({ id: created.id, ciudad: created.ciudad, nombre: created.nombre });
  }
  console.log("✓ 3 sucursales (Valencia, San Diego, Naguanagua)");

  // ── TipoPersonal ──
  const tiposPersonalData = [
    { nombre: "admin", pagaMensual: 800 },
    { nombre: "gerente", pagaMensual: 650 },
    { nombre: "trabajador", pagaMensual: 350 },
    { nombre: "delivery", pagaMensual: 300 },
  ];
  const tiposPersonal: { id: number; nombre: string; pagaMensual: number }[] = [];
  for (const tp of tiposPersonalData) {
    const created = await prisma.tipoPersonal.upsert({ where: { nombre: tp.nombre }, create: tp, update: {} });
    tiposPersonal.push(created);
  }
  console.log("✓ 4 tipos de personal");

  // ── Personal ──
  const personalData = [
    { nombre: "Admin", apellido: "Fit", cedula: "V-60000001", correo: "admin.fitzone@gmail.com", password: "admin123", rol: "admin" as const, tipoPersonalId: tiposPersonal.find(t => t.nombre === "admin")!.id },
    { nombre: "Trabajador", apellido: "Fit", cedula: "V-60000002", correo: "trabajador.fitzone@gmail.com", password: "worker123", rol: "trabajador" as const, tipoPersonalId: tiposPersonal.find(t => t.nombre === "trabajador")!.id },
    { nombre: "Delivery", apellido: "Fit", cedula: "V-60000003", correo: "delivery.fitzone@gmail.com", password: "delivery123", rol: "delivery" as const, tipoPersonalId: tiposPersonal.find(t => t.nombre === "delivery")!.id },
  ];
  for (const p of personalData) {
    const hashed = await bcrypt.hash(p.password, SALT_ROUNDS);
    await prisma.personal.upsert({ where: { correo: p.correo }, create: { ...p, password: hashed }, update: {} });
  }
  const gerentesData = [
    { nombre: "Gerente", apellido: "Valencia", cedula: "V-60000101", correo: "gerente.valencia.fitzone@gmail.com", password: "gerente123", sucursalId: sucursales[0].id, tipoPersonalId: tiposPersonal.find(t => t.nombre === "gerente")!.id },
    { nombre: "Gerente", apellido: "San Diego", cedula: "V-60000102", correo: "gerente.sandiego.fitzone@gmail.com", password: "gerente123", sucursalId: sucursales[1].id, tipoPersonalId: tiposPersonal.find(t => t.nombre === "gerente")!.id },
    { nombre: "Gerente", apellido: "Naguanagua", cedula: "V-60000103", correo: "gerente.nagua.fitzone@gmail.com", password: "gerente123", sucursalId: sucursales[2].id, tipoPersonalId: tiposPersonal.find(t => t.nombre === "gerente")!.id },
  ];
  for (const g of gerentesData) {
    const hashed = await bcrypt.hash(g.password, SALT_ROUNDS);
    await prisma.personal.upsert({ where: { correo: g.correo }, create: { ...g, password: hashed, rol: "gerente" }, update: {} });
  }
  const deliveryUser = await prisma.personal.findUniqueOrThrow({ where: { correo: "delivery.fitzone@gmail.com" } });
  console.log("✓ Personal (admin, gerentes, trabajador, delivery)");

  // ── Categorías ──
  const categoriasData = [
    { nombre: "Deportes", descripcion: "Equipamiento deportivo y balones" },
    { nombre: "Fitness", descripcion: "Accesorios de entrenamiento y fitness" },
    { nombre: "Suplementos", descripcion: "Suplementos nutricionales y proteínas" },
    { nombre: "Ropa Deportiva", descripcion: "Ropa y calzado deportivo para entrenamiento" },
  ];
  const categorias: { id: number; nombre: string }[] = [];
  for (const c of categoriasData) {
    const created = await prisma.categoria.upsert({ where: { nombre: c.nombre }, create: c, update: {} });
    categorias.push({ id: created.id, nombre: created.nombre });
  }
  console.log("✓ 4 categorías");

  // ── Productos ──
  const prodTemplates: Record<string, { nombre: string; descripcion: string; precioBase: number; costo: number; imagen: string; tipo: string; emailProveedor: string }[]> = {
    Deportes: [
      { nombre: "Balón de Baloncesto", descripcion: "Balón baloncesto tamaño 7 cuero sintético oficial", precioBase: 35, costo: randFloat(14, 24), imagen: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80", tipo: "deporte", emailProveedor: "deportes@activewear.com" },
      { nombre: "Raqueta de Tenis", descripcion: "Raqueta tenis carbono ligero encordada", precioBase: 85, costo: randFloat(34, 59), imagen: "https://images.unsplash.com/photo-1617083934381-12503233516c?auto=format&fit=crop&w=800&q=80", tipo: "deporte", emailProveedor: "deportes@activewear.com" },
      { nombre: "Bicicleta Estática", descripcion: "Bicicleta estática magnética con resistencia ajustable", precioBase: 350, costo: randFloat(140, 245), imagen: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80", tipo: "deporte", emailProveedor: "fitness@equipment.com" },
      { nombre: "Pesas Dumbbell 2x5kg", descripcion: "Set de pesas dumbbell neopreno 2x5kg", precioBase: 45, costo: randFloat(18, 31), imagen: "https://images.unsplash.com/photo-1638536532686-d610adfc8e5c?auto=format&fit=crop&w=800&q=80", tipo: "deporte", emailProveedor: "fitness@equipment.com" },
      { nombre: "Bandas Elásticas Resistencia", descripcion: "Set 5 bandas elásticas resistencia progresiva", precioBase: 18, costo: randFloat(7, 12), imagen: "https://images.unsplash.com/photo-1598262137446-24ebf5195b6c?auto=format&fit=crop&w=800&q=80", tipo: "deporte", emailProveedor: "fitness@equipment.com" },
    ],
    Fitness: [
      { nombre: "Colchoneta Fitness Premium", descripcion: "Colchoneta fitness antideslizante 6mm premium", precioBase: 28, costo: randFloat(11, 19), imagen: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?auto=format&fit=crop&w=800&q=80", tipo: "fitness", emailProveedor: "fitness@equipment.com" },
      { nombre: "Botella Agua Deportiva 1L", descripcion: "Botella deportiva 1 litro con filtro y dosificador", precioBase: 15, costo: randFloat(6, 10), imagen: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80", tipo: "fitness", emailProveedor: "accesorios@fitzone.com" },
      { nombre: "Toalla Deporte Microfibra", descripcion: "Toalla microfibra secado rápido 70x140cm", precioBase: 12, costo: randFloat(4.8, 8.4), imagen: "https://images.unsplash.com/photo-1628153326164-9844e137b01d?auto=format&fit=crop&w=800&q=80", tipo: "fitness", emailProveedor: "textiles@fitzone.com" },
      { nombre: "Rodillo Espuma Masaje", descripcion: "Rodillo espuma EVA masaje muscular 45cm", precioBase: 22, costo: randFloat(8.8, 15.4), imagen: "https://images.unsplash.com/photo-1600881333168-2ef49b341f30?auto=format&fit=crop&w=800&q=80", tipo: "fitness", emailProveedor: "fitness@equipment.com" },
      { nombre: "Bolso Deporte Grande", descripcion: "Bolso deportivo grande resistente al agua 50L", precioBase: 40, costo: randFloat(16, 28), imagen: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80", tipo: "fitness", emailProveedor: "accesorios@fitzone.com" },
    ],
    Suplementos: [
      { nombre: "Proteína Whey 2kg", descripcion: "Proteína whey isolate 2kg sabor chocolate", precioBase: 65, costo: randFloat(26, 45), imagen: "https://images.unsplash.com/photo-1579758629938-03607ccdbaba?auto=format&fit=crop&w=800&q=80", tipo: "suplemento", emailProveedor: "suplementos@nutriciontotal.com" },
      { nombre: "BCAA 400g", descripcion: "BCAA 2:1:1 aminoácidos ramificados 400g", precioBase: 30, costo: randFloat(12, 21), imagen: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=800&q=80", tipo: "suplemento", emailProveedor: "suplementos@nutriciontotal.com" },
      { nombre: "Barra Energética x12", descripcion: "Pack 12 barras energéticas proteína y avena", precioBase: 24, costo: randFloat(9.6, 16.8), imagen: "https://images.unsplash.com/photo-1622484211148-7163014a796e?auto=format&fit=crop&w=800&q=80", tipo: "suplemento", emailProveedor: "snacks@nutriciontotal.com" },
      { nombre: "Pre-entreno 300g", descripcion: "Pre-entreno 300g con cafeína y beta-alanina", precioBase: 35, costo: randFloat(14, 24), imagen: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?auto=format&fit=crop&w=800&q=80", tipo: "suplemento", emailProveedor: "suplementos@nutriciontotal.com" },
    ],
    "Ropa Deportiva": [
      { nombre: "Camiseta Dry-Fit", descripcion: "Camiseta deportiva dry-fit transpirable manga corta", precioBase: 25, costo: randFloat(10, 17), imagen: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80", tipo: "ropa deportiva", emailProveedor: "ropa@fitzone.com" },
      { nombre: "Pantalón Deportivo", descripcion: "Pantalón deportivo largo ajustado con bolsillos", precioBase: 38, costo: randFloat(15, 26), imagen: "https://images.unsplash.com/photo-1552902865-b72c031ac5ea?auto=format&fit=crop&w=800&q=80", tipo: "ropa deportiva", emailProveedor: "ropa@fitzone.com" },
      { nombre: "Sudadera con Capucha", descripcion: "Sudadera deportiva con capucha y bolsillo canguro", precioBase: 45, costo: randFloat(18, 31), imagen: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80", tipo: "ropa deportiva", emailProveedor: "ropa@fitzone.com" },
      { nombre: "Calcetines Deportivos x3", descripcion: "Pack 3 pares calcetines deportivos compresión media", precioBase: 14, costo: randFloat(5.6, 9.8), imagen: "https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?auto=format&fit=crop&w=800&q=80", tipo: "ropa deportiva", emailProveedor: "ropa@fitzone.com" },
      { nombre: "Short Deportivo", descripcion: "Short deportivo ligero con forro interior elástico", precioBase: 22, costo: randFloat(8.8, 15.4), imagen: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=800&q=80", tipo: "ropa deportiva", emailProveedor: "ropa@fitzone.com" },
    ],
  };

  const productos: { id: number; precioBase: number; costo: number; nombre: string; categoriaId: number }[] = [];
  for (const [cat, prods] of Object.entries(prodTemplates)) {
    const catId = categorias.find(c => c.nombre === cat)!.id;
    for (const p of prods) {
      const created = await prisma.producto.create({ data: { ...p, categoriaId: catId } });
      productos.push({ id: created.id, precioBase: created.precioBase, costo: created.costo ?? 0, nombre: created.nombre, categoriaId: created.categoriaId });
    }
  }
  console.log(`✓ ${productos.length} productos con imágenes`);

  // ── Inventario ──
  let invCount = 0;
  for (const suc of sucursales) {
    for (const prod of productos) {
      const stockActual = rand(5, 40);
      const stockMinimo = rand(5, 15);
      const estado = stockActual === 0 ? "critico" : stockActual <= stockMinimo ? "bajo" : "optimo";
      await prisma.inventario.create({
        data: { sucursalId: suc.id, productoId: prod.id, stockActual, stockMinimo, cantVentas: rand(5, 80), estadoStock: estado, status: stockActual === 0 ? "no disponible" : "disponible" },
      });
      invCount++;
    }
  }
  console.log(`✓ ${invCount} inventarios`);

  // ── Clientes ──
  const clienteHash = await bcrypt.hash("cliente123", SALT_ROUNDS);
  const nombres = ["María", "José", "Ana", "Carlos", "Laura", "Miguel", "Sofía", "Diego", "Valentina", "Juan", "Gabriela", "Pedro", "Daniela", "Luis", "Paula", "Andrés", "Camila", "Alejandro", "Andrea", "Fernando", "Lucía", "Ricardo", "Elena", "Pablo", "Victoria", "Javier", "Isabella", "Antonio", "Natalia", "Hugo"];
  const apellidos = ["García", "Rodríguez", "Martínez", "López", "Hernández", "González", "Pérez", "Sánchez", "Ramírez", "Torres", "Flores", "Rivera", "Gómez", "Díaz", "Cruz", "Morales", "Reyes", "Castillo", "Ortiz", "Medina"];
  const ciudadesCliente = ["Valencia", "San Diego", "Naguanagua"];
  const clientes: { id: number; nombre: string; apellido: string }[] = [];

  for (let i = 0; i < 30; i++) {
    const ciudad = ciudadesCliente[i % 3];
    const tipoCliente = i < 5 ? "oro" : i < 15 ? "plata" : "bronce";
    const created = await prisma.cliente.upsert({
      where: { correo: `cliente${i + 1}@gmail.com` },
      create: { nombre: nombres[i], apellido: apellidos[i % apellidos.length], cedula: `V-${rand(10000000, 30000000)}`, correo: `cliente${i + 1}@gmail.com`, password: clienteHash, telefono: `+58-414-${rand(1000000, 9999999)}`, direccion: `${["Av.", "Calle", "Carrera"][i % 3]} ${rand(1, 99)}, ${ciudad}`, tipoCliente },
      update: {},
    });
    clientes.push({ id: created.id, nombre: created.nombre, apellido: created.apellido });
  }
  await prisma.cliente.upsert({
    where: { correo: "cliente@demo.com" },
    create: { nombre: "Cliente", apellido: "Demo", cedula: "V-11111111", correo: "cliente@demo.com", password: clienteHash, telefono: "+58-414-1111111", direccion: "Av. Principal, Valencia", tipoCliente: "plata" },
    update: {},
  });
  console.log(`✓ ${clientes.length} clientes`);

  // ── Compras ──
  const statuses = ["completada", "completada", "completada", "completada", "pendiente", "cancelado"];
  const tipos = ["compra_directa", "compra_web"];
  let compraCount = 0;
  const meses = 6;
  const seisMesesAtras = new Date(now.getFullYear(), now.getMonth() - meses, 1);
  for (let i = 0; i < 240; i++) {
    const cliente = clientes[rand(0, clientes.length - 1)];
    const sucursal = sucursales[rand(0, sucursales.length - 1)];
    const status = statuses[rand(0, statuses.length - 1)];
    const tipo = tipos[rand(0, 1)];
    const repartidorId = status === "entregado" || status === "en_camino" ? deliveryUser.id : null;
    const diasDesdeInicio = Math.floor((now.getTime() - seisMesesAtras.getTime()) / 86400000);
    const fecha = new Date(seisMesesAtras.getTime() + rand(0, diasDesdeInicio) * 86400000 + rand(0, 86400000));
    const numDetalles = 1 + rand(0, 3);
    let total = 0;
    const detalles: { productoId: number; cantidad: number; precioUnit: number; costoUnit?: number }[] = [];
    const usedIds = new Set<number>();
    for (let d = 0; d < numDetalles; d++) {
      let prod;
      do { prod = productos[rand(0, productos.length - 1)]; } while (usedIds.has(prod.id));
      usedIds.add(prod.id);
      const cantidad = rand(1, 4);
      total += cantidad * prod.precioBase;
      detalles.push({ productoId: prod.id, cantidad, precioUnit: prod.precioBase, costoUnit: prod.costo ?? undefined });
    }
    await prisma.compra.create({ data: { clienteId: cliente.id, sucursalId: sucursal.id, repartidorId, total, tipo, status, fecha, detalles: { create: detalles } } });
    compraCount++;
  }
  console.log(`✓ ${compraCount} compras`);

  // ── Conexiones ──
  let connCount = 0;
  const devices = ["Android", "iPhone", "Windows Desktop", "MacBook Pro", "iPad", "Linux Desktop", "Android Tablet"];
  const providers = ["CANTV", "Movistar", "Digitel", "Inter"];
  const venezuelaCoords: [number, number, string][] = [
    [10.1621, -68.0024, "Valencia"], [10.1700, -67.9900, "Valencia Este"], [10.1550, -68.0100, "Valencia Oeste"],
    [10.1500, -68.0200, "Valencia Sur"], [10.2450, -67.9800, "San Diego"], [10.2550, -67.9700, "San Diego Centro"],
    [10.2350, -67.9900, "San Diego Norte"], [10.2800, -68.0200, "Naguanagua"], [10.2900, -68.0100, "Naguanagua Este"],
    [10.2700, -68.0300, "Naguanagua Oeste"],
  ];
  for (const cliente of clientes) {
    const numConn = rand(3, 8);
    for (let j = 0; j < numConn; j++) {
      const coord = venezuelaCoords[rand(0, venezuelaCoords.length - 1)];
      const lat = coord[0] + randFloat(-0.05, 0.05);
      const lng = coord[1] + randFloat(-0.05, 0.05);
      await prisma.conexion.create({
        data: { clienteId: cliente.id, dispositivoId: `dev-${cliente.id}-${rand(1000, 9999)}`, ip: `${rand(180, 200)}.${rand(0, 255)}.${rand(0, 255)}.${rand(0, 255)}`, latitud: lat, longitud: lng, dispositivo: `${devices[rand(0, devices.length - 1)]} (${providers[rand(0, providers.length - 1)]})`, fecha: new Date(now.getTime() - rand(0, 180) * 86400000) },
      });
      connCount++;
    }
  }
  console.log(`✓ ${connCount} conexiones`);

  // ── Competidores (Apify API si hay token, si no fallback hardcodeado) ──
  const competidoresFallback: CompetitorData[] = [
    { nombre: "Deportes Extremos", ciudad: "Valencia", direccion: "CC Metropolitano, Nivel 1", coordenadasLat: 10.1600, coordenadasLng: -68.0000, cantReviews: 120, ratingPromedio: 4.0, tipoNegocio: "Tienda Deportiva", categories: '["Deportes","Fitness"]', placeId: "ChIJ-fz-1", website: "https://deportesextremos.com", phone: "+58-241-555-1000" },
    { nombre: "FitStore Venezuela", ciudad: "Valencia", direccion: "Av. Bolívar, Edif. FitStore", coordenadasLat: 10.1650, coordenadasLng: -68.0050, cantReviews: 90, ratingPromedio: 4.3, tipoNegocio: "Tienda Fitness", categories: '["Fitness","Suplementos"]', placeId: "ChIJ-fz-2", website: "https://fitstore.com", phone: "+58-241-555-2000" },
    { nombre: "Suplementos Total", ciudad: "San Diego", direccion: "Av. Principal, CC San Diego", coordenadasLat: 10.2480, coordenadasLng: -67.9780, cantReviews: 65, ratingPromedio: 4.1, tipoNegocio: "Nutrición Deportiva", categories: '["Suplementos"]', placeId: "ChIJ-fz-3", website: "https://suplementostotal.com", phone: "+58-241-555-3000" },
    { nombre: "SportWorld", ciudad: "Naguanagua", direccion: "Av. Universidad, CC Viva Naguanagua", coordenadasLat: 10.2820, coordenadasLng: -68.0220, cantReviews: 110, ratingPromedio: 3.8, tipoNegocio: "Tienda Deportiva", categories: '["Deportes","Fitness","Suplementos"]', placeId: "ChIJ-fz-4", website: "https://sportworld.com", phone: "+58-241-555-4000" },
    { nombre: "GymCenter", ciudad: "Valencia", direccion: "Calle 100, Edif. GymCenter", coordenadasLat: 10.1580, coordenadasLng: -68.0080, cantReviews: 75, ratingPromedio: 4.2, tipoNegocio: "Equipamiento Fitness", categories: '["Fitness"]', placeId: "ChIJ-fz-5", website: "https://gymcenter.com", phone: "+58-241-555-5000" },
  ];

  let competidoresApi = competidoresFallback;
  if (process.env.APIFY_TOKEN) {
    competidoresApi = await retryWithFallback(
      "Competidores (Apify)",
      () => fetchCompetidores("Valencia", ["Deportes", "Fitness", "Suplementos"]),
      competidoresFallback
    );
  }

  const competidoresIds: number[] = [];
  for (const c of competidoresApi) {
    const created = await prisma.competidor.upsert({
      where: { placeId: c.placeId },
      create: c,
      update: {
        nombre: c.nombre, ciudad: c.ciudad, direccion: c.direccion,
        coordenadasLat: c.coordenadasLat, coordenadasLng: c.coordenadasLng,
        cantReviews: c.cantReviews, ratingPromedio: c.ratingPromedio,
        tipoNegocio: c.tipoNegocio, categories: c.categories,
        website: c.website, phone: c.phone, ultimaVerif: new Date(),
      },
    });
    competidoresIds.push(created.id);
  }
  console.log(`✓ ${competidoresIds.length} competidores`);

  // ── BusquedaCompetidor ──
  const busquedasData = [
    { categorias: '["Deportes","Fitness"]', ciudades: '["Valencia"]', maxPlaces: 5, indices: [0, 1] },
    { categorias: '["Fitness","Suplementos"]', ciudades: '["Valencia"]', maxPlaces: 5, indices: [1] },
    { categorias: '["Suplementos"]', ciudades: '["San Diego"]', maxPlaces: 5, indices: [2] },
    { categorias: '["Deportes","Fitness","Suplementos"]', ciudades: '["Naguanagua"]', maxPlaces: 5, indices: [3] },
  ];
  for (const b of busquedasData) {
    const busqueda = await prisma.busquedaCompetidor.upsert({
      where: { categorias_ciudades_maxPlaces: { categorias: b.categorias, ciudades: b.ciudades, maxPlaces: b.maxPlaces } },
      create: { categorias: b.categorias, ciudades: b.ciudades, maxPlaces: b.maxPlaces }, update: {},
    });
    for (const idx of b.indices) {
      try { await prisma.competidoresBusqueda.create({ data: { busquedaId: busqueda.id, competidorId: competidoresIds[idx] } }); } catch {}
    }
  }
  console.log("✓ Búsquedas competidores");

  // ── Ofertas ──
  const ofertasData = [
    { nombre: "Fit Month", descripcion: "15% desc en toda la categoría Fitness", tipo: "porcentaje", valor: 15, montoMinimo: 20, fechaInicio: new Date(now.getFullYear(), now.getMonth() - 2, 1), fechaFin: new Date(now.getFullYear(), now.getMonth() + 2, 1), activo: true, prioridad: 1, categoriaId: categorias[1].id, productoId: undefined as number | undefined },
    { nombre: "Suplementos 20% OFF", descripcion: "20% de descuento en suplementos seleccionados", tipo: "porcentaje", valor: 20, montoMinimo: 40, fechaInicio: new Date(now.getFullYear(), now.getMonth() - 1, 1), fechaFin: new Date(now.getFullYear(), now.getMonth() + 1, 1), activo: true, prioridad: 2, categoriaId: undefined as number | undefined, productoId: productos.find(p => p.nombre === "Proteína Whey 2kg")!.id },
    { nombre: "Dumbbell Flash", descripcion: "$10 fijos de descuento en pesas dumbbell", tipo: "monto_fijo", valor: 10, montoMinimo: 45, fechaInicio: new Date(now.getFullYear(), now.getMonth() - 3, 1), fechaFin: new Date(now.getFullYear(), now.getMonth() + 1, 1), activo: true, prioridad: 3, categoriaId: undefined as number | undefined, productoId: productos.find(p => p.nombre === "Pesas Dumbbell 2x5kg")!.id },
  ];
  for (const o of ofertasData) {
    const created = await prisma.oferta.create({ data: o as any });
    for (const s of sucursales) { await prisma.ofertaSucursal.create({ data: { ofertaId: created.id, sucursalId: s.id } }); }
  }
  console.log("✓ Ofertas");

  // ── GeoIP ──
  const geoIPsData = [
    { ip: "190.10.0.1", proveedor: "CANTV", ciudad: "Valencia", pais: "Venezuela", latitud: 10.1621, longitud: -68.0024 },
    { ip: "190.10.0.2", proveedor: "Movistar", ciudad: "San Diego", pais: "Venezuela", latitud: 10.2450, longitud: -67.9800 },
    { ip: "190.10.0.3", proveedor: "Digitel", ciudad: "Naguanagua", pais: "Venezuela", latitud: 10.2800, longitud: -68.0200 },
    { ip: "190.10.0.4", proveedor: "CANTV", ciudad: "Puerto Cabello", pais: "Venezuela", latitud: 10.4631, longitud: -68.0125 },
    { ip: "190.10.0.5", proveedor: "Inter", ciudad: "Tocuyito", pais: "Venezuela", latitud: 10.0986, longitud: -68.0856 },
  ];
  for (const g of geoIPsData) { await prisma.geoIP.upsert({ where: { ip: g.ip }, create: g, update: {} }); }
  const geoIPIds = (await prisma.geoIP.findMany({ select: { id: true } })).map(g => g.id);
  console.log("✓ GeoIPs");

  // ── Auditoría ──
  const rutas = ["/", "/admin", "/api/tienda/productos", "/api/compras/mis-compras", "/api/productos", "/api/sucursales", "/api/analisis/patrones", "/estadisticas", "/globy"];
  const metodos = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  for (let i = 0; i < 30; i++) {
    await prisma.auditoria.create({
      data: { ip: `190.10.0.${rand(1, 5)}`, ruta: rutas[rand(0, rutas.length - 1)], metodo: metodos[rand(0, metodos.length - 1)], clienteId: Math.random() > 0.5 ? clientes[rand(0, clientes.length - 1)].id : null, geoIPId: geoIPIds.length > 0 ? geoIPIds[rand(0, geoIPIds.length - 1)] : null, createdAt: new Date(now.getTime() - rand(0, 150) * 86400000) },
    });
  }
  console.log("✓ Auditorías");

  // ── Coeficientes de Estacionalidad ──
  for (const c of COEFICIENTES) {
    await prisma.coeficienteFestividad.upsert({
      where: { mes: c.mes }, create: c,
      update: {
        coeficienteConsumoMasivo: c.coeficienteConsumoMasivo,
        coeficienteTecnologia: c.coeficienteTecnologia,
        coeficienteRopa: c.coeficienteRopa,
        coeficienteRestaurantes: c.coeficienteRestaurantes,
        coeficientePromedio: c.coeficientePromedio,
      },
    });
  }
  console.log("✓ 12 coeficientes de estacionalidad");

  // ── Ciudades de Venezuela — GeoDB API (top 10) ──
  const ciudadesFallback: GeoDBCity[] = [
    { nombre: "Caracas", region: "Distrito Capital", poblacion: 2245744, latitud: 10.5061, longitud: -66.9144 },
    { nombre: "Maracaibo", region: "Zulia", poblacion: 1551539, latitud: 10.6667, longitud: -71.6333 },
    { nombre: "Valencia", region: "Carabobo", poblacion: 1385621, latitud: 10.1667, longitud: -68.0 },
    { nombre: "Barquisimeto", region: "Lara", poblacion: 1059092, latitud: 10.0678, longitud: -69.3467 },
    { nombre: "Ciudad Guayana", region: "Bolívar", poblacion: 877518, latitud: 8.3739, longitud: -62.5611 },
    { nombre: "Maracay", region: "Aragua", poblacion: 837423, latitud: 10.2333, longitud: -67.6 },
    { nombre: "Barinas", region: "Barinas", poblacion: 873962, latitud: 8.6333, longitud: -70.2167 },
    { nombre: "San Juan de los Morros", region: "Guárico", poblacion: 137329, latitud: 9.9015, longitud: -67.3543 },
  ];

  const ciudadesApi = await retryWithFallback("Ciudades de Venezuela (GeoDB, top 10)", fetchTopCiudades, ciudadesFallback);

  for (const c of ciudadesApi) {
    await prisma.ciudadPoblacion.upsert({
      where: { nombre_region: { nombre: c.nombre, region: c.region } },
      create: c,
      update: { poblacion: c.poblacion },
    });
  }
  console.log(`✓ ${ciudadesApi.length} ciudades de Venezuela`);

  console.log("\n✅ Seed FitZone completado!");
  console.log(`   🏪 ${sucursales.length} sucursales`);
  console.log(`   📦 ${productos.length} productos con imágenes`);
  console.log(`   📦 ${invCount} inventarios`);
  console.log(`   👥 ${clientes.length} clientes`);
  console.log(`   🛒 ${compraCount} compras`);
  console.log(`   📡 ${connCount} conexiones`);
  console.log(`   🏬 ${competidoresIds.length} competidores`);
  console.log(`   🏷️  ${ofertasData.length} ofertas`);
  console.log(`   🎯 12 coeficientes de estacionalidad`);
  console.log(`   🌎 ${ciudadesApi.length} ciudades de Venezuela`);
}

main()
  .catch((e) => { console.error("❌ Error durante el seed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
