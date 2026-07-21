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
  console.log("🛒 Seed SuperMarket Plus — Supermercado\n");

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
      id: 1, nombreEmpresa: "SuperMarket Plus", rif: "J-50505050-5",
      direccionFiscal: "Av. 5 de Julio, Edif. SM Plus, Maracaibo",
      telefono: "+58-261-555-5050", logoUrl: null, pais: "Venezuela",
      colorPrimario: "#e63946", bannerImg: null,
      bannerTitle: "SuperMarket Plus",
      bannerSubtitle: "Tu supermercado de confianza — calidad y buen precio todos los días",
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
  console.log("✓ EmpresaConfig — SuperMarket Plus");

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
    { nombre: "SM Plus Maracaibo", ciudad: "Maracaibo", direccion: "Av. 5 de Julio, Edif. SM Plus, PB", coordenadasLat: 10.6317, coordenadasLng: -71.6403, tipo: "principal" },
    { nombre: "SM Plus Cabimas", ciudad: "Cabimas", direccion: "Av. Intercomunal, CC Cabimas Center, Local 3", coordenadasLat: 10.3950, coordenadasLng: -71.4500, tipo: "secundaria" },
    { nombre: "SM Plus Ciudad Ojeda", ciudad: "Ciudad Ojeda", direccion: "Av. Principal, CC Lago Mall, Nivel 2", coordenadasLat: 10.2100, coordenadasLng: -71.3000, tipo: "secundaria" },
  ];
  const sucursales: { id: number; ciudad: string; nombre: string }[] = [];
  for (const s of sucursalesData) {
    const created = await prisma.sucursal.create({ data: s });
    sucursales.push({ id: created.id, ciudad: created.ciudad, nombre: created.nombre });
  }
  console.log(`✓ ${sucursales.length} sucursales`);

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
  console.log(`✓ ${tiposPersonal.length} tipos de personal`);

  // ── Personal ──
  const personalData = [
    { nombre: "Admin", apellido: "SM", cedula: "V-50000001", correo: "admin.sm@gmail.com", password: "admin123", rol: "admin" as const, tipoPersonalId: tiposPersonal.find(t => t.nombre === "admin")!.id },
    { nombre: "Trabajador", apellido: "SM", cedula: "V-50000002", correo: "trabajador.sm@gmail.com", password: "worker123", rol: "trabajador" as const, tipoPersonalId: tiposPersonal.find(t => t.nombre === "trabajador")!.id },
    { nombre: "Delivery", apellido: "SM", cedula: "V-50000003", correo: "delivery.sm@gmail.com", password: "delivery123", rol: "delivery" as const, tipoPersonalId: tiposPersonal.find(t => t.nombre === "delivery")!.id },
  ];
  for (const p of personalData) {
    const hashed = await bcrypt.hash(p.password, SALT_ROUNDS);
    await prisma.personal.upsert({ where: { correo: p.correo }, create: { ...p, password: hashed }, update: {} });
  }
  const gerentesData = [
    { nombre: "Gerente", apellido: "Maracaibo", cedula: "V-50000101", correo: "gerente.maracaibo.sm@gmail.com", password: "gerente123", sucursalId: sucursales[0].id, tipoPersonalId: tiposPersonal.find(t => t.nombre === "gerente")!.id },
    { nombre: "Gerente", apellido: "Cabimas", cedula: "V-50000102", correo: "gerente.cabimas.sm@gmail.com", password: "gerente123", sucursalId: sucursales[1].id, tipoPersonalId: tiposPersonal.find(t => t.nombre === "gerente")!.id },
    { nombre: "Gerente", apellido: "Ciudad Ojeda", cedula: "V-50000103", correo: "gerente.ojeda.sm@gmail.com", password: "gerente123", sucursalId: sucursales[2].id, tipoPersonalId: tiposPersonal.find(t => t.nombre === "gerente")!.id },
  ];
  for (const g of gerentesData) {
    const hashed = await bcrypt.hash(g.password, SALT_ROUNDS);
    await prisma.personal.upsert({ where: { correo: g.correo }, create: { ...g, password: hashed, rol: "gerente" }, update: {} });
  }
  const deliveryUser = await prisma.personal.findUniqueOrThrow({ where: { correo: "delivery.sm@gmail.com" } });
  console.log("✓ Personal");

  // ── Categorías ──
  const categoriasData = [
    { nombre: "Alimentos", descripcion: "Productos alimenticios no perecederos" },
    { nombre: "Bebidas", descripcion: "Bebidas gaseosas, lácteas y jugos" },
    { nombre: "Limpieza", descripcion: "Productos de limpieza para el hogar" },
    { nombre: "Hogar", descripcion: "Artículos desechables y de uso diario" },
    { nombre: "Lácteos y Embutidos", descripcion: "Productos lácteos, quesos y embutidos" },
  ];
  const categorias: { id: number; nombre: string }[] = [];
  for (const c of categoriasData) {
    const created = await prisma.categoria.upsert({ where: { nombre: c.nombre }, create: c, update: {} });
    categorias.push({ id: created.id, nombre: created.nombre });
  }
  console.log(`✓ ${categorias.length} categorías`);

  // ── Productos ──
  const prodTemplates: Record<string, { nombre: string; descripcion: string; precioBase: number; costo: number; imagen: string; tipo: string; emailProveedor: string }[]> = {
    "Alimentos": [
      { nombre: "Pasta Spaghetti 500g", descripcion: "Pasta spaghetti de sémola de trigo premium 500g", precioBase: 2.5, costo: randFloat(1, 1.5), imagen: "https://images.unsplash.com/photo-1551462147-ff29053bfc14?auto=format&fit=crop&w=800&q=80", tipo: "alimento", emailProveedor: "alimentos@distribuidora.com" },
      { nombre: "Harina de Trigo 1kg", descripcion: "Harina de trigo todo uso 1 kilogramo", precioBase: 2.8, costo: randFloat(1.1, 1.7), imagen: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80", tipo: "alimento", emailProveedor: "alimentos@distribuidora.com" },
      { nombre: "Azúcar Blanca 1kg", descripcion: "Azúcar blanca refinada 1 kilogramo", precioBase: 2.2, costo: randFloat(0.9, 1.4), imagen: "https://images.unsplash.com/photo-1581447100512-675517331268?auto=format&fit=crop&w=800&q=80", tipo: "alimento", emailProveedor: "alimentos@distribuidora.com" },
      { nombre: "Sal Marina 500g", descripcion: "Sal marina fina 500 gramos", precioBase: 1.5, costo: randFloat(0.6, 1), imagen: "https://images.unsplash.com/photo-1613082441163-0e1cb4febd1b?auto=format&fit=crop&w=800&q=80", tipo: "alimento", emailProveedor: "alimentos@distribuidora.com" },
      { nombre: "Galletas de Chocolate", descripcion: "Galletas rellenas de chocolate 200g", precioBase: 3.5, costo: randFloat(1.4, 2.1), imagen: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80", tipo: "alimento", emailProveedor: "snacks@distribuidora.com" },
      { nombre: "Leche en Polvo 400g", descripcion: "Leche en polvo entera fortificada 400g", precioBase: 6, costo: randFloat(2.4, 3.6), imagen: "https://images.unsplash.com/photo-1553456558-aff63285bdd1?auto=format&fit=crop&w=800&q=80", tipo: "alimento", emailProveedor: "lacteos@distribuidora.com" },
    ],
    "Bebidas": [
      { nombre: "Refresco Cola 2L", descripcion: "Refresco sabor cola 2 litros", precioBase: 3, costo: randFloat(1.2, 1.8), imagen: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80", tipo: "bebida", emailProveedor: "bebidas@hidratar.com" },
      { nombre: "Cerveza Artesanal 6-pack", descripcion: "Cerveza artesanal rubia 355ml x6 unidades", precioBase: 12, costo: randFloat(4.8, 7.2), imagen: "https://images.unsplash.com/photo-1532634922-8fe0b757fb13?auto=format&fit=crop&w=800&q=80", tipo: "bebida", emailProveedor: "cervezas@artisanales.com" },
      { nombre: "Leche Deslactosada 1L", descripcion: "Leche deslactosada pasteurizada 1 litro", precioBase: 2.8, costo: randFloat(1.1, 1.7), imagen: "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=800&q=80", tipo: "bebida", emailProveedor: "lacteos@distribuidora.com" },
      { nombre: "Jugo Natural de Naranja 1L", descripcion: "Jugo de naranja natural pasteurizado 1 litro", precioBase: 4, costo: randFloat(1.6, 2.4), imagen: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=800&q=80", tipo: "bebida", emailProveedor: "jugos@naturalplus.com" },
    ],
    "Limpieza": [
      { nombre: "Detergente Líquido 1L", descripcion: "Detergente líquido para ropa 1 litro", precioBase: 5.5, costo: randFloat(2.2, 3.3), imagen: "https://images.unsplash.com/photo-1610557892470-76d747eed2f3?auto=format&fit=crop&w=800&q=80", tipo: "limpieza", emailProveedor: "limpieza@hogarplus.com" },
      { nombre: "Desinfectante Multiusos 750ml", descripcion: "Desinfectante multiusos aroma lavanda 750ml", precioBase: 4, costo: randFloat(1.6, 2.4), imagen: "https://images.unsplash.com/photo-1584813539691-e40854b73b5e?auto=format&fit=crop&w=800&q=80", tipo: "limpieza", emailProveedor: "limpieza@hogarplus.com" },
      { nombre: "Jabón de Manos 500ml", descripcion: "Jabón líquido antibacterial para manos 500ml", precioBase: 3.2, costo: randFloat(1.3, 1.9), imagen: "https://images.unsplash.com/photo-1607006342411-92fc4641200b?auto=format&fit=crop&w=800&q=80", tipo: "limpieza", emailProveedor: "cuidado@glowlab.com" },
    ],
    "Hogar": [
      { nombre: "Bolsas de Basura 30uds", descripcion: "Bolsas para basura resistentes 30 unidades", precioBase: 4.5, costo: randFloat(1.8, 2.7), imagen: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=800&q=80", tipo: "hogar", emailProveedor: "desechables@hogarplus.com" },
      { nombre: "Servilletas x100", descripcion: "Servilletas de papel premium x100 unidades", precioBase: 3, costo: randFloat(1.2, 1.8), imagen: "https://images.unsplash.com/photo-1574634534894-89d7576c8259?auto=format&fit=crop&w=800&q=80", tipo: "hogar", emailProveedor: "desechables@hogarplus.com" },
      { nombre: "Papel Higiénico 12rollos", descripcion: "Papel higiénico doble hoja 12 rollos", precioBase: 8, costo: randFloat(3.2, 4.8), imagen: "https://images.unsplash.com/photo-1584556812952-905ffd0c611a?auto=format&fit=crop&w=800&q=80", tipo: "hogar", emailProveedor: "desechables@hogarplus.com" },
    ],
    "Lácteos y Embutidos": [
      { nombre: "Queso Amarillo 500g", descripcion: "Queso amarillo tipo americano rebanado 500g", precioBase: 7.5, costo: randFloat(3, 5.2), imagen: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=800&q=80", tipo: "lácteo", emailProveedor: "lacteos@distribuidora.com" },
      { nombre: "Jamón de Pavo 250g", descripcion: "Jamón de pavo ahumado rebanado 250g", precioBase: 5.5, costo: randFloat(2.2, 3.8), imagen: "https://images.unsplash.com/photo-1524182576066-1d963e940027?auto=format&fit=crop&w=800&q=80", tipo: "embutido", emailProveedor: "embutidos@distribuidora.com" },
      { nombre: "Mantequilla con Sal 200g", descripcion: "Mantequilla con sal 200g para cocinar y untar", precioBase: 4.2, costo: randFloat(1.7, 2.9), imagen: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=800&q=80", tipo: "lácteo", emailProveedor: "lacteos@distribuidora.com" },
      { nombre: "Yogurt Natural 1L", descripcion: "Yogurt natural cremoso 1 litro sin azúcar añadida", precioBase: 4.8, costo: randFloat(1.9, 3.3), imagen: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80", tipo: "lácteo", emailProveedor: "lacteos@distribuidora.com" },
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
      const stockActual = rand(15, 100);
      const stockMinimo = rand(10, 30);
      const estado = stockActual === 0 ? "critico" : stockActual <= stockMinimo ? "bajo" : "optimo";
      await prisma.inventario.create({
        data: { sucursalId: suc.id, productoId: prod.id, stockActual, stockMinimo, cantVentas: rand(20, 200), estadoStock: estado, status: stockActual === 0 ? "no disponible" : "disponible" },
      });
      invCount++;
    }
  }
  console.log(`✓ ${invCount} inventarios`);

  // ── Clientes ──
  const clienteHash = await bcrypt.hash("cliente123", SALT_ROUNDS);
  const nombres = ["María", "José", "Ana", "Carlos", "Laura", "Miguel", "Sofía", "Diego", "Valentina", "Juan", "Gabriela", "Pedro", "Daniela", "Luis", "Paula", "Andrés", "Camila", "Alejandro", "Andrea", "Fernando", "Lucía", "Ricardo", "Elena", "Pablo", "Victoria", "Javier", "Isabella", "Antonio", "Natalia", "Hugo"];
  const apellidos = ["García", "Rodríguez", "Martínez", "López", "Hernández", "González", "Pérez", "Sánchez", "Ramírez", "Torres", "Flores", "Rivera", "Gómez", "Díaz", "Cruz", "Morales", "Reyes", "Castillo", "Ortiz", "Medina"];
  const ciudadesCliente = ["Maracaibo", "Cabimas", "Ciudad Ojeda"];
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
    create: { nombre: "Cliente", apellido: "Demo", cedula: "V-11111111", correo: "cliente@demo.com", password: clienteHash, telefono: "+58-414-1111111", direccion: "Av. Principal, Maracaibo", tipoCliente: "plata" },
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
    const numDetalles = 2 + rand(0, 4);
    let total = 0;
    const detalles: { productoId: number; cantidad: number; precioUnit: number; costoUnit?: number }[] = [];
    const usedIds = new Set<number>();
    for (let d = 0; d < numDetalles; d++) {
      let prod;
      do { prod = productos[rand(0, productos.length - 1)]; } while (usedIds.has(prod.id));
      usedIds.add(prod.id);
      const cantidad = rand(1, 8);
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
    [10.6317, -71.6403, "Maracaibo"], [10.6400, -71.6300, "Maracaibo Norte"], [10.6200, -71.6500, "Maracaibo Sur"], [10.6500, -71.6200, "Maracaibo Oeste"], [10.3950, -71.4500, "Cabimas"], [10.3800, -71.4600, "Cabimas Centro"], [10.4000, -71.4400, "Cabimas Norte"], [10.2100, -71.3000, "Ciudad Ojeda"], [10.2000, -71.3100, "Ciudad Ojeda Este"], [10.2200, -71.2900, "Ciudad Ojeda Oeste"],
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
    { nombre: "SuperAlimentos C.A.", ciudad: "Maracaibo", direccion: "Av. Bella Vista, CC Sambil", coordenadasLat: 10.6350, coordenadasLng: -71.6450, cantReviews: 310, ratingPromedio: 4.3, tipoNegocio: "Supermercado", categories: '["Alimentos","Bebidas","Hogar"]', placeId: "ChIJ-sm-1", website: "https://superalimentos.com", phone: "+58-261-555-1000" },
    { nombre: "Abastos Venezuela", ciudad: "Maracaibo", direccion: "Calle 77, Edif. Ávila", coordenadasLat: 10.6380, coordenadasLng: -71.6380, cantReviews: 200, ratingPromedio: 3.8, tipoNegocio: "Abasto", categories: '["Alimentos","Bebidas"]', placeId: "ChIJ-sm-2", website: "https://abastosvenezuela.com", phone: "+58-261-555-2000" },
    { nombre: "Distribuidora Los Andes", ciudad: "Cabimas", direccion: "Av. Intercomunal, Galpón 5", coordenadasLat: 10.3920, coordenadasLng: -71.4480, cantReviews: 85, ratingPromedio: 3.7, tipoNegocio: "Distribuidora", categories: '["Alimentos","Limpieza","Hogar"]', placeId: "ChIJ-sm-3", website: "https://distlosandes.com", phone: "+58-264-555-3000" },
    { nombre: "Central Madeirense", ciudad: "Maracaibo", direccion: "Av. 5 de Julio, CC Lago Mall", coordenadasLat: 10.6330, coordenadasLng: -71.6420, cantReviews: 450, ratingPromedio: 4.5, tipoNegocio: "Supermercado", categories: '["Alimentos","Bebidas","Limpieza","Hogar"]', placeId: "ChIJ-sm-4", website: "https://centralmadeirense.com", phone: "+58-261-555-4000" },
    { nombre: "Bicentenario", ciudad: "Ciudad Ojeda", direccion: "Av. Principal, CC Bicentenario", coordenadasLat: 10.2120, coordenadasLng: -71.2980, cantReviews: 120, ratingPromedio: 3.9, tipoNegocio: "Supermercado", categories: '["Alimentos","Bebidas"]', placeId: "ChIJ-sm-5", website: "https://bicentenario.com", phone: "+58-265-555-5000" },
  ];

  let competidoresApi = competidoresFallback;
  if (process.env.APIFY_TOKEN) {
    competidoresApi = await retryWithFallback(
      "Competidores (Apify)",
      () => fetchCompetidores("Maracaibo", ["Supermercado", "Alimentos", "Abasto"]),
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
    { categorias: '["Alimentos","Bebidas","Hogar"]', ciudades: '["Maracaibo"]', maxPlaces: 5, indices: [0, 1, 3] },
    { categorias: '["Alimentos","Limpieza","Hogar"]', ciudades: '["Cabimas"]', maxPlaces: 5, indices: [2] },
    { categorias: '["Alimentos","Bebidas"]', ciudades: '["Ciudad Ojeda"]', maxPlaces: 5, indices: [4] },
    { categorias: '["Alimentos","Bebidas","Limpieza","Hogar"]', ciudades: '["Maracaibo"]', maxPlaces: 5, indices: [3] },
  ];
  for (const b of busquedasData) {
    const busqueda = await prisma.busquedaCompetidor.upsert({
      where: { categorias_ciudades_maxPlaces: { categorias: b.categorias, ciudades: b.ciudades, maxPlaces: b.maxPlaces } },
      create: { categorias: b.categorias, ciudades: b.ciudades, maxPlaces: b.maxPlaces }, update: {},
    });
    for (const idx of b.indices) {
      try { await prisma.competidoresBusqueda.create({ data: { busquedaId: busqueda.id, competidorId: competidoresIds[idx] } }); } catch { /* ya existe */ }
    }
  }
  console.log("✓ Búsquedas competidores");

  // ── Ofertas ──
  const ofertasData = [
    { nombre: "Descuento Alimentos", descripcion: "10% desc en toda la categoría Alimentos", tipo: "porcentaje", valor: 10, montoMinimo: 0, fechaInicio: new Date(now.getFullYear(), now.getMonth() - 2, 1), fechaFin: new Date(now.getFullYear(), now.getMonth() + 2, 1), activo: true, prioridad: 1, categoriaId: categorias[0].id, productoId: undefined as number | undefined },
    { nombre: "2x1 en Bebidas", descripcion: "Lleva 2 bebidas al precio de 1 en seleccionados", tipo: "porcentaje", valor: 50, montoMinimo: 6, fechaInicio: new Date(now.getFullYear(), now.getMonth() - 1, 1), fechaFin: new Date(now.getFullYear(), now.getMonth() + 1, 1), activo: true, prioridad: 2, categoriaId: categorias[1].id, productoId: undefined as number | undefined },
    { nombre: "Pack Limpieza", descripcion: "$5 fijos de descuento en compras de limpieza", tipo: "monto_fijo", valor: 5, montoMinimo: 15, fechaInicio: new Date(now.getFullYear(), now.getMonth() - 3, 1), fechaFin: new Date(now.getFullYear(), now.getMonth() + 1, 1), activo: true, prioridad: 3, categoriaId: undefined as number | undefined, productoId: productos.find(p => p.nombre === "Detergente Líquido 1L")!.id },
  ];
  for (const o of ofertasData) {
    const created = await prisma.oferta.create({ data: o as any });
    for (const s of sucursales) { await prisma.ofertaSucursal.create({ data: { ofertaId: created.id, sucursalId: s.id } }); }
  }
  console.log("✓ Ofertas");

  // ── GeoIP ──
  const geoIPsData = [
    { ip: "190.10.0.1", proveedor: "CANTV", ciudad: "Maracaibo", pais: "Venezuela", latitud: 10.6317, longitud: -71.6403 },
    { ip: "190.10.0.2", proveedor: "Movistar", ciudad: "Cabimas", pais: "Venezuela", latitud: 10.3950, longitud: -71.4500 },
    { ip: "190.10.0.3", proveedor: "Digitel", ciudad: "Ciudad Ojeda", pais: "Venezuela", latitud: 10.2100, longitud: -71.3000 },
    { ip: "190.10.0.4", proveedor: "CANTV", ciudad: "Machiques", pais: "Venezuela", latitud: 10.0608, longitud: -72.5523 },
    { ip: "190.10.0.5", proveedor: "Inter", ciudad: "La Villa del Rosario", pais: "Venezuela", latitud: 10.3167, longitud: -72.3167 },
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

  console.log("\n✅ Seed SuperMarket Plus completado!");
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
