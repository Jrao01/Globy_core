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

/* ─────────── Fetch: Tasas BCV ─────────── */
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

/* ─────────── Fetch: Ciudades (GeoDB) ─────────── */
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

/* ─────────── Fetch: Competidores (Apify) ─────────── */
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

/* ─────────── Coeficientes de Estacionalidad ─────────── */
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

/* ─────────── MAIN ─────────── */
async function main() {
  console.log("🌐 Seed TechWorld — Tienda de Tecnología\n");

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

  await prisma.empresaConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1, nombreEmpresa: "TechWorld", rif: "J-40404040-4",
      direccionFiscal: "Av. Francisco de Miranda, CC Lido, Local 2B, Caracas",
      telefono: "+58-212-555-4040", logoUrl: null, pais: "Venezuela",
      colorPrimario: "#00d4ff", bannerImg: null,
      bannerTitle: "TechWorld", bannerSubtitle: "Tu tienda de tecnología de confianza — productos originales con garantía",
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
  console.log("✓ EmpresaConfig — TechWorld");

  await prisma.gestionEconomica.upsert({
    where: { id: 1 },
    create: { id: 1, monedaPrincipal: "USD", autoUpdate: true },
    update: {},
  });
  console.log("✓ GestionEconomica");

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

  const sucursalesData = [
    { nombre: "TechWorld Caracas", ciudad: "Caracas", direccion: "Av. Francisco de Miranda, CC Lido, Local 2B", coordenadasLat: 10.4961, coordenadasLng: -66.8442, tipo: "principal" },
    { nombre: "TechWorld Barquisimeto", ciudad: "Barquisimeto", direccion: "Carrera 19, CC Sambil Barquisimeto, Nivel 1", coordenadasLat: 10.0731, coordenadasLng: -69.3227, tipo: "secundaria" },
    { nombre: "TechWorld Puerto La Cruz", ciudad: "Puerto La Cruz", direccion: "Av. Municipal, CC Plaza Mayor, Local 8", coordenadasLat: 10.1814, coordenadasLng: -64.6764, tipo: "secundaria" },
  ];
  const sucursales: { id: number; ciudad: string; nombre: string }[] = [];
  for (const s of sucursalesData) {
    const created = await prisma.sucursal.create({ data: s });
    sucursales.push({ id: created.id, ciudad: created.ciudad, nombre: created.nombre });
  }
  console.log(`✓ ${sucursales.length} sucursales`);

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

  const personalData = [
    { nombre: "Admin", apellido: "Tech", cedula: "V-40000001", correo: "admin.techworld@gmail.com", password: "admin123", rol: "admin" as const, tipoPersonalId: tiposPersonal.find(t => t.nombre === "admin")!.id },
    { nombre: "Trabajador", apellido: "Tech", cedula: "V-40000002", correo: "trabajador.techworld@gmail.com", password: "worker123", rol: "trabajador" as const, tipoPersonalId: tiposPersonal.find(t => t.nombre === "trabajador")!.id },
    { nombre: "Delivery", apellido: "Tech", cedula: "V-40000003", correo: "delivery.techworld@gmail.com", password: "delivery123", rol: "delivery" as const, tipoPersonalId: tiposPersonal.find(t => t.nombre === "delivery")!.id },
  ];
  for (const p of personalData) {
    const hashed = await bcrypt.hash(p.password, SALT_ROUNDS);
    await prisma.personal.upsert({ where: { correo: p.correo }, create: { ...p, password: hashed }, update: {} });
  }
  const gerentesData = [
    { nombre: "Gerente", apellido: "Caracas", cedula: "V-40000101", correo: "gerente.caracas.techworld@gmail.com", password: "gerente123", sucursalId: sucursales[0].id, tipoPersonalId: tiposPersonal.find(t => t.nombre === "gerente")!.id },
    { nombre: "Gerente", apellido: "Barquisimeto", cedula: "V-40000102", correo: "gerente.barquisimeto.techworld@gmail.com", password: "gerente123", sucursalId: sucursales[1].id, tipoPersonalId: tiposPersonal.find(t => t.nombre === "gerente")!.id },
    { nombre: "Gerente", apellido: "Puerto La Cruz", cedula: "V-40000103", correo: "gerente.plc.techworld@gmail.com", password: "gerente123", sucursalId: sucursales[2].id, tipoPersonalId: tiposPersonal.find(t => t.nombre === "gerente")!.id },
  ];
  for (const g of gerentesData) {
    const hashed = await bcrypt.hash(g.password, SALT_ROUNDS);
    await prisma.personal.upsert({ where: { correo: g.correo }, create: { ...g, password: hashed, rol: "gerente" }, update: {} });
  }
  const deliveryUser = await prisma.personal.findUniqueOrThrow({ where: { correo: "delivery.techworld@gmail.com" } });
  console.log("✓ Personal");

  const categoriasData = [
    { nombre: "Electrónica", descripcion: "Dispositivos electrónicos y accesorios" },
    { nombre: "Computación", descripcion: "Equipos de cómputo y periféricos" },
    { nombre: "Gaming", descripcion: "Videojuegos y accesorios gaming" },
    { nombre: "Audio y Video", descripcion: "Equipos de audio, video y streaming" },
  ];
  const categorias: { id: number; nombre: string }[] = [];
  for (const c of categoriasData) {
    const created = await prisma.categoria.upsert({ where: { nombre: c.nombre }, create: c, update: {} });
    categorias.push({ id: created.id, nombre: created.nombre });
  }
  console.log(`✓ ${categorias.length} categorías`);

  const prodTemplates: Record<string, { nombre: string; descripcion: string; precioBase: number; costo: number; imagen: string; tipo: string; emailProveedor: string }[]> = {
    "Electrónica": [
      { nombre: 'Smart TV 55" 4K', descripcion: "Smart TV 55 pulgadas resolución 4K UHD con HDR10+", precioBase: 650, costo: randFloat(260, 390), imagen: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=800&q=80", tipo: "electrónico", emailProveedor: "distribucion@tvworld.com" },
      { nombre: 'Tablet 10.5"', descripcion: "Tablet 10.5 pulgadas pantalla IPS 64GB almacenamiento", precioBase: 280, costo: randFloat(112, 168), imagen: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=800&q=80", tipo: "electrónico", emailProveedor: "ventas@tabletdirect.com" },
      { nombre: "Smartwatch Deportivo", descripcion: "Smartwatch con GPS monitor cardíaco y resistencia al agua", precioBase: 180, costo: randFloat(72, 126), imagen: "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&w=800&q=80", tipo: "electrónico", emailProveedor: "info@wearabletech.com" },
      { nombre: "Cámara Web HD 1080p", descripcion: "Cámara web 1080p con micrófono integrado y ajuste de luz", precioBase: 55, costo: randFloat(22, 38), imagen: "https://images.unsplash.com/photo-1628126235206-5260b9ea6441?auto=format&fit=crop&w=800&q=80", tipo: "electrónico", emailProveedor: "ventas@techworld.com" },
      { nombre: "Parlante Bluetooth Portátil", descripcion: "Parlante Bluetooth portátil 20W resistente al agua IPX7", precioBase: 70, costo: randFloat(28, 49), imagen: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=800&q=80", tipo: "electrónico", emailProveedor: "audio@techworld.com" },
    ],
    "Computación": [
      { nombre: "Laptop Gaming RTX 4070", descripcion: "Laptop gaming RTX 4070 32GB RAM 1TB SSD i9", precioBase: 1500, costo: randFloat(600, 1050), imagen: "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=800&q=80", tipo: "computación", emailProveedor: "proveedor@laptopsdirect.com" },
      { nombre: 'Monitor Curvo 32" 144Hz', descripcion: "Monitor curvo 32 pulgadas 144Hz 2K QHD", precioBase: 380, costo: randFloat(152, 266), imagen: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80", tipo: "computación", emailProveedor: "monitores@displayplus.com" },
      { nombre: "SSD Externo 1TB", descripcion: "SSD externo portátil 1TB USB-C lectura 1050MB/s", precioBase: 95, costo: randFloat(38, 66), imagen: "https://images.unsplash.com/photo-1597843797221-a3f8983fa991?auto=format&fit=crop&w=800&q=80", tipo: "computación", emailProveedor: "almacenamiento@techworld.com" },
      { nombre: "Hub USB-C 7 en 1", descripcion: "Hub USB-C multipuerto HDMI USB-A SD/microSD PD 100W", precioBase: 35, costo: randFloat(14, 24), imagen: "https://images.unsplash.com/photo-1547082299-de196ea013d6?auto=format&fit=crop&w=800&q=80", tipo: "computación", emailProveedor: "accesorios@techworld.com" },
      { nombre: "Silla Ergonómica Gaming", descripcion: "Silla gaming ergonómica ajustable reposabrazos 4D", precioBase: 320, costo: randFloat(128, 224), imagen: "https://images.unsplash.com/photo-1598550476439-6847785fce6e?auto=format&fit=crop&w=800&q=80", tipo: "mueble", emailProveedor: "muebles@techworld.com" },
    ],
    "Gaming": [
      { nombre: "Control Inalámbrico Pro", descripcion: "Control inalámbrico con batería recargable y gatillos hápticos", precioBase: 65, costo: randFloat(26, 45), imagen: "https://images.unsplash.com/photo-1600080972464-8e5f3580243a?auto=format&fit=crop&w=800&q=80", tipo: "gaming", emailProveedor: "gaming@techworld.com" },
      { nombre: "Headset Gaming 7.1", descripcion: "Auriculares gaming 7.1 surround sonido envolvente RGB", precioBase: 85, costo: randFloat(34, 59), imagen: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80", tipo: "gaming", emailProveedor: "audio@techworld.com" },
      { nombre: "Base Cargadora Dual", descripcion: "Base de carga para 2 controles con carga rápida LED", precioBase: 30, costo: randFloat(12, 21), imagen: "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?auto=format&fit=crop&w=800&q=80", tipo: "gaming", emailProveedor: "accesorios@techworld.com" },
      { nombre: "Mousepad XXL RGB", descripcion: "Mousepad XXL 900x400mm retroiluminación RGB personalizable", precioBase: 28, costo: randFloat(11, 19), imagen: "https://images.unsplash.com/photo-1616440347437-b1c73416efc2?auto=format&fit=crop&w=800&q=80", tipo: "gaming", emailProveedor: "gaming@techworld.com" },
      { nombre: "Webcam Streaming 4K", descripcion: "Webcam 4K con enfoque automático y micrófono estéreo", precioBase: 120, costo: randFloat(48, 84), imagen: "https://images.unsplash.com/photo-1600541519463-9605906eecca?auto=format&fit=crop&w=800&q=80", tipo: "gaming", emailProveedor: "streaming@techworld.com" },
    ],
    "Audio y Video": [
      { nombre: "Audífonos In-Ear ANC", descripcion: "Audífonos in-ear con cancelación activa de ruido ANC", precioBase: 95, costo: randFloat(38, 66), imagen: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80", tipo: "audio", emailProveedor: "audio@techworld.com" },
      { nombre: "Soundbar 2.1", descripcion: "Soundbar 2.1 canales con subwoofer inalámbrico 200W", precioBase: 180, costo: randFloat(72, 126), imagen: "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80", tipo: "audio", emailProveedor: "audio@techworld.com" },
      { nombre: "Micrófono USB Condensador", descripcion: "Micrófono condensador USB cardioide para podcast y streaming", precioBase: 75, costo: randFloat(30, 52), imagen: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=800&q=80", tipo: "audio", emailProveedor: "streaming@techworld.com" },
      { nombre: "Cámara de Acción 4K", descripcion: "Cámara de acción 4K sumergible con estabilización digital", precioBase: 220, costo: randFloat(88, 154), imagen: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80", tipo: "video", emailProveedor: "video@techworld.com" },
      { nombre: "Proyector Portátil LED", descripcion: "Proyector portátil LED 1080p con parlante integrado", precioBase: 250, costo: randFloat(100, 175), imagen: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80", tipo: "video", emailProveedor: "video@techworld.com" },
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

  let invCount = 0;
  for (const suc of sucursales) {
    for (const prod of productos) {
      const stockActual = rand(2, 30);
      const stockMinimo = rand(3, 10);
      const estado = stockActual === 0 ? "critico" : stockActual <= stockMinimo ? "bajo" : "optimo";
      await prisma.inventario.create({
        data: { sucursalId: suc.id, productoId: prod.id, stockActual, stockMinimo, cantVentas: rand(0, 60), estadoStock: estado, status: stockActual === 0 ? "no disponible" : "disponible" },
      });
      invCount++;
    }
  }
  console.log(`✓ ${invCount} inventarios`);

  const clienteHash = await bcrypt.hash("cliente123", SALT_ROUNDS);
  const nombres = ["María", "José", "Ana", "Carlos", "Laura", "Miguel", "Sofía", "Diego", "Valentina", "Juan", "Gabriela", "Pedro", "Daniela", "Luis", "Paula", "Andrés", "Camila", "Alejandro", "Andrea", "Fernando", "Lucía", "Ricardo", "Elena", "Pablo", "Victoria", "Javier", "Isabella", "Antonio", "Natalia", "Hugo"];
  const apellidos = ["García", "Rodríguez", "Martínez", "López", "Hernández", "González", "Pérez", "Sánchez", "Ramírez", "Torres", "Flores", "Rivera", "Gómez", "Díaz", "Cruz", "Morales", "Reyes", "Castillo", "Ortiz", "Medina"];
  const ciudadesCliente = ["Caracas", "Barquisimeto", "Puerto La Cruz"];
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
    create: { nombre: "Cliente", apellido: "Demo", cedula: "V-11111111", correo: "cliente@demo.com", password: clienteHash, telefono: "+58-414-1111111", direccion: "Av. Principal, Caracas", tipoCliente: "plata" },
    update: {},
  });
  console.log(`✓ ${clientes.length} clientes`);

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
      const cantidad = rand(1, 5);
      total += cantidad * prod.precioBase;
      detalles.push({ productoId: prod.id, cantidad, precioUnit: prod.precioBase, costoUnit: prod.costo ?? undefined });
    }
    await prisma.compra.create({ data: { clienteId: cliente.id, sucursalId: sucursal.id, repartidorId, total, tipo, status, fecha, detalles: { create: detalles } } });
    compraCount++;
  }
  console.log(`✓ ${compraCount} compras`);

  let connCount = 0;
  const devices = ["Android", "iPhone", "Windows Desktop", "MacBook Pro", "iPad", "Linux Desktop", "Android Tablet"];
  const providers = ["CANTV", "Movistar", "Digitel", "Inter"];
  const venezuelaCoords: [number, number, string][] = [
    [10.4961, -66.8442, "Caracas"], [10.4880, -66.8500, "Caracas Este"], [10.4700, -66.9600, "Caracas Oeste"], [10.5000, -66.8800, "Caracas Centro"], [10.0731, -69.3227, "Barquisimeto"], [10.0650, -69.3100, "Barquisimeto Norte"], [10.0800, -69.3400, "Barquisimeto Sur"], [10.1814, -64.6764, "Puerto La Cruz"], [10.1900, -64.6600, "Puerto La Cruz Este"], [10.1700, -64.6900, "Puerto La Cruz Oeste"],
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

  const competidoresFallback: CompetitorData[] = [
    { nombre: "ElectroMundo C.A.", ciudad: "Caracas", direccion: "CC Sambil, Nivel 2", coordenadasLat: 10.4961, coordenadasLng: -66.8442, cantReviews: 230, ratingPromedio: 4.2, tipoNegocio: "Tienda de Electrónica", categories: '["Electrónica","Computación"]', placeId: "ChIJ-tw-1", website: "https://electromundo.com", phone: "+58-212-555-1000" },
    { nombre: "TechShop Venezuela", ciudad: "Caracas", direccion: "Av. Libertador, Edif. Tech", coordenadasLat: 10.4880, coordenadasLng: -66.8730, cantReviews: 150, ratingPromedio: 4.5, tipoNegocio: "Tecnología", categories: '["Electrónica","Computación","Gaming"]', placeId: "ChIJ-tw-2", website: "https://techshop.co.ve", phone: "+58-212-555-2000" },
    { nombre: "iGadget Store", ciudad: "Caracas", direccion: "CC El Recreo, Local 45", coordenadasLat: 10.4920, coordenadasLng: -66.8600, cantReviews: 95, ratingPromedio: 4.0, tipoNegocio: "Accesorios Tecnológicos", categories: '["Electrónica"]', placeId: "ChIJ-tw-3", website: "https://igadget.com", phone: "+58-212-555-3000" },
    { nombre: "Computronic", ciudad: "Barquisimeto", direccion: "Carrera 17, Edif. Computronic", coordenadasLat: 10.0750, coordenadasLng: -69.3250, cantReviews: 78, ratingPromedio: 3.9, tipoNegocio: "Computación", categories: '["Computación"]', placeId: "ChIJ-tw-4", website: "https://computronic.com", phone: "+58-251-555-4000" },
    { nombre: "GameZone", ciudad: "Puerto La Cruz", direccion: "CC Plaza Mayor, Nivel 3", coordenadasLat: 10.1830, coordenadasLng: -64.6780, cantReviews: 62, ratingPromedio: 4.1, tipoNegocio: "Tienda Gaming", categories: '["Gaming"]', placeId: "ChIJ-tw-5", website: "https://gamezone.com", phone: "+58-281-555-5000" },
  ];

  let competidoresApi = competidoresFallback;
  if (process.env.APIFY_TOKEN) {
    competidoresApi = await retryWithFallback(
      "Competidores (Apify)",
      () => fetchCompetidores("Caracas", ["Electrónica", "Tecnología", "Computación"]),
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

  const busquedasData = [
    { categorias: '["Electrónica","Computación"]', ciudades: '["Caracas"]', maxPlaces: 5, indices: [0, 1] },
    { categorias: '["Electrónica"]', ciudades: '["Caracas"]', maxPlaces: 5, indices: [2] },
    { categorias: '["Computación"]', ciudades: '["Barquisimeto"]', maxPlaces: 5, indices: [3] },
    { categorias: '["Gaming"]', ciudades: '["Puerto La Cruz"]', maxPlaces: 5, indices: [4] },
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

  const ofertasData = [
    { nombre: "Semana Tech", descripcion: "12% desc en todo Electrónica y Computación", tipo: "porcentaje", valor: 12, montoMinimo: 100, fechaInicio: new Date(now.getFullYear(), now.getMonth() - 2, 1), fechaFin: new Date(now.getFullYear(), now.getMonth() + 2, 1), activo: true, prioridad: 1, categoriaId: categorias[0].id, productoId: undefined as number | undefined },
    { nombre: "Gaming Weekend", descripcion: "$15 fijos de descuento en productos gaming", tipo: "monto_fijo", valor: 15, montoMinimo: 80, fechaInicio: new Date(now.getFullYear(), now.getMonth() - 1, 1), fechaFin: new Date(now.getFullYear(), now.getMonth() + 1, 1), activo: true, prioridad: 2, categoriaId: undefined as number | undefined, productoId: productos.find(p => p.nombre === "Headset Gaming 7.1")!.id },
    { nombre: "Monitor Flash", descripcion: '20% desc en el Monitor Curvo 32"', tipo: "porcentaje", valor: 20, montoMinimo: 300, fechaInicio: new Date(now.getFullYear(), now.getMonth() - 3, 1), fechaFin: new Date(now.getFullYear(), now.getMonth() + 1, 1), activo: true, prioridad: 3, categoriaId: undefined as number | undefined, productoId: productos.find(p => p.nombre === 'Monitor Curvo 32" 144Hz')!.id },
  ];
  for (const o of ofertasData) {
    const created = await prisma.oferta.create({ data: o as any });
    for (const s of sucursales) { await prisma.ofertaSucursal.create({ data: { ofertaId: created.id, sucursalId: s.id } }); }
  }
  console.log("✓ Ofertas");

  const geoIPsData = [
    { ip: "190.10.0.1", proveedor: "CANTV", ciudad: "Caracas", pais: "Venezuela", latitud: 10.4806, longitud: -66.9036 },
    { ip: "190.10.0.2", proveedor: "Movistar", ciudad: "Barquisimeto", pais: "Venezuela", latitud: 10.0731, longitud: -69.3227 },
    { ip: "190.10.0.3", proveedor: "Digitel", ciudad: "Puerto La Cruz", pais: "Venezuela", latitud: 10.1814, longitud: -64.6764 },
    { ip: "190.10.0.4", proveedor: "CANTV", ciudad: "Maracay", pais: "Venezuela", latitud: 10.2469, longitud: -67.5958 },
    { ip: "190.10.0.5", proveedor: "Inter", ciudad: "Maturín", pais: "Venezuela", latitud: 9.7467, longitud: -63.1767 },
  ];
  for (const g of geoIPsData) { await prisma.geoIP.upsert({ where: { ip: g.ip }, create: g, update: {} }); }
  const geoIPIds = (await prisma.geoIP.findMany({ select: { id: true } })).map(g => g.id);
  console.log("✓ GeoIPs");

  const rutas = ["/", "/admin", "/api/tienda/productos", "/api/compras/mis-compras", "/api/productos", "/api/sucursales", "/api/analisis/patrones", "/estadisticas", "/globy"];
  const metodos = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  for (let i = 0; i < 30; i++) {
    await prisma.auditoria.create({
      data: { ip: `190.10.0.${rand(1, 5)}`, ruta: rutas[rand(0, rutas.length - 1)], metodo: metodos[rand(0, metodos.length - 1)], clienteId: Math.random() > 0.5 ? clientes[rand(0, clientes.length - 1)].id : null, geoIPId: geoIPIds.length > 0 ? geoIPIds[rand(0, geoIPIds.length - 1)] : null, createdAt: new Date(now.getTime() - rand(0, 150) * 86400000) },
    });
  }
  console.log("✓ Auditorías");

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

  console.log("\n✅ Seed TechWorld completado!");
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
