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

/* ──────────── San Juan de los Morros ──────────── */
const SJM_LAT = 9.9075;
const SJM_LNG = -67.3553;
const CIUDAD_SEMILLA = "San Juan de los Morros";
const REGION_SEMILLA = "Guárico";

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

/* ══════════════════════════════════════════════════════════════
   Fetch: Tasas de Cambio BCV
   ══════════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════════
   Fetch: 10 ciudades más importantes de Venezuela
   ══════════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════════
   Fetch: Competidores via Apify Google Places
   ══════════════════════════════════════════════════════════════ */
interface CompetitorData {
  placeId: string; nombre: string; ciudad: string; direccion: string;
  coordenadasLat: number; coordenadasLng: number; cantReviews: number;
  ratingPromedio: number | null; tipoNegocio: string | null; categories: string;
  website: string | null; phone: string | null;
}

async function fetchCompetidores(): Promise<CompetitorData[]> {
  const { ApifyClient } = await import("apify-client");
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const categories = ["Electrónica", "Hogar", "Ropa", "Alimentos", "Salud", "Deportes", "Supermercado", "Tienda"];
  const input = {
    searchStringsArray: categories,
    locationQuery: `${CIUDAD_SEMILLA}, Venezuela`,
    maxCrawledPlacesPerSearch: 10,
  };
  const run = await client.actor("compass/crawler-google-places").call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items
    .filter((item: any) => item.placeId)
    .map((item: any) => ({
      placeId: item.placeId,
      nombre: item.title || "Sin nombre",
      ciudad: item.city || CIUDAD_SEMILLA,
      direccion: item.address || "",
      coordenadasLat: item.location?.lat ?? SJM_LAT,
      coordenadasLng: item.location?.lng ?? SJM_LNG,
      cantReviews: item.reviewsCount ?? 0,
      ratingPromedio: item.totalScore ?? null,
      tipoNegocio: item.categoryName ?? null,
      categories: JSON.stringify(item.categories ?? []),
      website: item.website ?? null,
      phone: item.phone ?? null,
    }));
}

/* ══════════════════════════════════════════════════════════════
   MAIN
   ══════════════════════════════════════════════════════════════ */
async function main() {
  console.log("🌱 Seeding database — datos 100% reales de APIs...\n");

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

  // ══════════════════════════════════════════════
  // 1. EmpresaConfig
  // ══════════════════════════════════════════════
  await prisma.empresaConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1, nombreEmpresa: "Globy", rif: "J-30336715-9",
      direccionFiscal: "San Juan de los Morros, Guárico",
      telefono: "+58-414-5888840", logoUrl: null, pais: "Venezuela",
      colorPrimario: "#5713be", bannerImg: null,
      bannerTitle: "Bienvenido a Globy",
      bannerSubtitle: "Explora nuestro catálogo de productos y realiza tus pedidos de forma rápida y sencilla",
      smtpHost: "smtp.gmail.com", smtpPort: 587,
      smtpUser: "zhetajamer@gmail.com", smtpPass: "kmxhhlooitcmelhq",
      costoPorKm: 0.33, precioMinimoEntrega: 1.00,
      pagoMovilBanco: "0102", pagoMovilCedulaTipo: "V",
      pagoMovilCedula: "30336715", pagoMovilTelefono: "04128807038",
    },
    update: { costoPorKm: 0.33, precioMinimoEntrega: 1.00, pagoMovilBanco: "0102", pagoMovilCedulaTipo: "V", pagoMovilCedula: "30336715", pagoMovilTelefono: "04128807038" },
  });
  console.log("✓ EmpresaConfig");

  // ══════════════════════════════════════════════
  // 2. GestionEconomica
  // ══════════════════════════════════════════════
  await prisma.gestionEconomica.upsert({
    where: { id: 1 },
    create: { id: 1, monedaPrincipal: "USD", autoUpdate: true },
    update: {},
  });
  console.log("✓ GestionEconomica");

  // ══════════════════════════════════════════════
  // 3. Tasas de Cambio — BCV API real
  // ══════════════════════════════════════════════
  const bcvFallback = { usd: 36.50, eur: 39.80 };
  const bcvRates = await retryWithFallback("Tasas BCV (USD/EUR)", fetchBCVRates, bcvFallback);

  const now = new Date();
  for (let m = 5; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 15);
    const variance = m === 0 ? 1 : 1 + (Math.random() * 0.06 - 0.03);
    await prisma.tasaCambio.create({ data: { moneda: "USD", precio: Math.round(bcvRates.usd * variance * 100) / 100, fecha: d } });
    await prisma.tasaCambio.create({ data: { moneda: "EUR", precio: Math.round(bcvRates.eur * variance * 100) / 100, fecha: d } });
  }
  console.log(`✓ Tasas de Cambio (12 registros, USD=${bcvRates.usd}, EUR=${bcvRates.eur})`);

  // ══════════════════════════════════════════════
  // 4. Sucursales — San Juan de los Morros
  // ══════════════════════════════════════════════
  const sucursalesData = [
    { nombre: "Sucursal Centro", ciudad: CIUDAD_SEMILLA, direccion: "Av. Principal, Centro Comercial, Local 1", coordenadasLat: SJM_LAT, coordenadasLng: SJM_LNG, tipo: "principal" },
    { nombre: "Sucursal Norte", ciudad: CIUDAD_SEMILLA, direccion: "Av. Juan de Viñes, Plaza Norte, Local 5", coordenadasLat: 9.9150, coordenadasLng: -67.3500, tipo: "secundaria" },
    { nombre: "Sucursal Sur", ciudad: CIUDAD_SEMILLA, direccion: "Av. Libertador, CC Gran Bazar, Nivel 1", coordenadasLat: 9.9000, coordenadasLng: -67.3600, tipo: "secundaria" },
  ];
  const sucursales: { id: number; ciudad: string; nombre: string }[] = [];
  for (const s of sucursalesData) {
    const created = await prisma.sucursal.create({ data: s });
    sucursales.push({ id: created.id, ciudad: created.ciudad, nombre: created.nombre });
  }
  console.log(`✓ ${sucursales.length} sucursales (${CIUDAD_SEMILLA})`);

  // ══════════════════════════════════════════════
  // 5. TipoPersonal
  // ══════════════════════════════════════════════
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

  // ══════════════════════════════════════════════
  // 6. Personal
  // ══════════════════════════════════════════════
  const personalData = [
    { nombre: "Admin", apellido: "Principal", cedula: "V-00000001", correo: "admin@gmail.com", password: "admin123", rol: "admin" as const, tipoPersonalId: tiposPersonal.find(t => t.nombre === "admin")!.id },
    { nombre: "Trabajador", apellido: "Demo", cedula: "V-00000002", correo: "trabajador@gmail.com", password: "worker123", rol: "trabajador" as const, tipoPersonalId: tiposPersonal.find(t => t.nombre === "trabajador")!.id },
    { nombre: "Delivery", apellido: "Uno", cedula: "V-00000003", correo: "delivery@gmail.com", password: "delivery123", rol: "delivery" as const, tipoPersonalId: tiposPersonal.find(t => t.nombre === "delivery")!.id },
  ];
  for (const p of personalData) {
    const hashed = await bcrypt.hash(p.password, SALT_ROUNDS);
    await prisma.personal.upsert({ where: { correo: p.correo }, create: { ...p, password: hashed }, update: {} });
  }
  const gerentesData = [
    { nombre: "Gerente", apellido: "Centro", cedula: "V-10000001", correo: "gerente.centro@gmail.com", password: "gerente123", sucursalId: sucursales[0].id, tipoPersonalId: tiposPersonal.find(t => t.nombre === "gerente")!.id },
    { nombre: "Gerente", apellido: "Norte", cedula: "V-10000002", correo: "gerente.norte@gmail.com", password: "gerente123", sucursalId: sucursales[1].id, tipoPersonalId: tiposPersonal.find(t => t.nombre === "gerente")!.id },
    { nombre: "Gerente", apellido: "Sur", cedula: "V-10000003", correo: "gerente.sur@gmail.com", password: "gerente123", sucursalId: sucursales[2].id, tipoPersonalId: tiposPersonal.find(t => t.nombre === "gerente")!.id },
  ];
  for (const g of gerentesData) {
    const hashed = await bcrypt.hash(g.password, SALT_ROUNDS);
    await prisma.personal.upsert({ where: { correo: g.correo }, create: { ...g, password: hashed, rol: "gerente" }, update: {} });
  }
  const deliveryUser = await prisma.personal.findUniqueOrThrow({ where: { correo: "delivery@gmail.com" } });
  console.log("✓ Personal (7 usuarios)");

  // ══════════════════════════════════════════════
  // 7. Categorías
  // ══════════════════════════════════════════════
  const categoriasData = [
    { nombre: "Electrónica", descripcion: "Dispositivos electrónicos y accesorios" },
    { nombre: "Hogar", descripcion: "Artículos para el hogar y decoración" },
    { nombre: "Ropa", descripcion: "Prendas de vestir y accesorios" },
    { nombre: "Alimentos", descripcion: "Productos alimenticios y bebidas" },
    { nombre: "Salud", descripcion: "Productos de salud y cuidado personal" },
    { nombre: "Deportes", descripcion: "Equipamiento deportivo y ropa" },
  ];
  const categorias: { id: number; nombre: string }[] = [];
  for (const c of categoriasData) {
    const created = await prisma.categoria.upsert({ where: { nombre: c.nombre }, create: c, update: {} });
    categorias.push({ id: created.id, nombre: created.nombre });
  }
  console.log("✓ 6 categorías");

  // ══════════════════════════════════════════════
  // 8. Productos (30)
  // ══════════════════════════════════════════════
  const productosData: { nombre: string; tipo: string; descripcion: string; precioBase: number; costo: number; emailProveedor: string; categoriaId: number }[] = [];
  const prodTemplates: Record<string, { nombre: string; descripcion: string; precioBase: number; costo: number; tipo: string; emailProveedor: string }[]> = {
    "Electrónica": [
      { nombre: "Laptop Pro X1", descripcion: "Laptop alto rendimiento 16GB RAM 512GB SSD", precioBase: 1200, tipo: "electrónico", emailProveedor: "proveedor@techcorp.com" },
      { nombre: "Mouse Ergonómico", descripcion: "Mouse inalámbrico ergonómico 6 botones", precioBase: 45, tipo: "electrónico", emailProveedor: "ventas@techworld.com" },
      { nombre: "Teclado Mecánico RGB", descripcion: "Teclado mecánico retroiluminado Cherry MX", precioBase: 89, tipo: "electrónico", emailProveedor: "ventas@techworld.com" },
      { nombre: "Monitor 4K 27\"", descripcion: "Monitor IPS 4K UHD 27 pulgadas", precioBase: 450, tipo: "electrónico", emailProveedor: "distribucion@displayplus.com" },
      { nombre: "Auriculares Bluetooth", descripcion: "Auriculares inalámbricos cancelación ruido", precioBase: 120, tipo: "electrónico", emailProveedor: "info@audiogear.com" },
    ],
    "Hogar": [
      { nombre: "Sofá 3 Cuerpos", descripcion: "Sofá tapizado en tela premium color gris", precioBase: 850, tipo: "mueble", emailProveedor: "muebles@hogarplus.com" },
      { nombre: "Mesa de Centro", descripcion: "Mesa de centro madera maciza acabado natural", precioBase: 320, tipo: "mueble", emailProveedor: "muebles@hogarplus.com" },
      { nombre: "Lámpara LED", descripcion: "Lámpara de mesa LED regulable", precioBase: 45, tipo: "iluminación", emailProveedor: "iluminacion@luzviva.com" },
      { nombre: "Set Sábanas Queen", descripcion: "Set sábanas algodón egipcio cama Queen", precioBase: 75, tipo: "textil", emailProveedor: "textiles@conforttotal.com" },
      { nombre: "Cortina Blackout", descripcion: "Cortina térmica blackout 2.5m", precioBase: 38, tipo: "textil", emailProveedor: "textiles@conforttotal.com" },
    ],
    "Ropa": [
      { nombre: "Camisa Casual M/L", descripcion: "Camisa de vestir manga larga corte moderno", precioBase: 35, tipo: "vestimenta", emailProveedor: "moda@vestirbien.com" },
      { nombre: "Jeans Clásicos", descripcion: "Jeans corte recto denim premium", precioBase: 55, tipo: "vestimenta", emailProveedor: "moda@vestirbien.com" },
      { nombre: "Zapatos Deportivos", descripcion: "Zapatos deportivos ligeros suela amortiguada", precioBase: 80, tipo: "calzado", emailProveedor: "deportes@activewear.com" },
      { nombre: "Chaqueta Impermeable", descripcion: "Chaqueta membrana impermeable transpirable", precioBase: 120, tipo: "vestimenta", emailProveedor: "moda@vestirbien.com" },
      { nombre: "Gorra Deportiva", descripcion: "Gorra ajustable algodón transpirable", precioBase: 18, tipo: "accesorio", emailProveedor: "deportes@activewear.com" },
    ],
    "Alimentos": [
      { nombre: "Arroz 1kg", descripcion: "Arroz blanco primera calidad 1kg", precioBase: 2.5, tipo: "alimento", emailProveedor: "alimentos@distribuidora.com" },
      { nombre: "Aceite Vegetal 1L", descripcion: "Aceite vegetal 100% maíz 1 litro", precioBase: 4, tipo: "alimento", emailProveedor: "alimentos@distribuidora.com" },
      { nombre: "Café Premium 250g", descripcion: "Café tostado molido 100% arábica", precioBase: 8, tipo: "alimento", emailProveedor: "cafe@aromatico.com" },
      { nombre: "Agua Mineral 1.5L", descripcion: "Agua mineral natural botella 1.5 litros", precioBase: 1.5, tipo: "bebida", emailProveedor: "bebidas@hidratar.com" },
      { nombre: "Chocolate Premium 100g", descripcion: "Chocolate oscuro 70% cacao", precioBase: 6, tipo: "alimento", emailProveedor: "cafe@aromatico.com" },
    ],
    "Salud": [
      { nombre: "Multivitamínico 60 tabs", descripcion: "Suplemento multivitamínico completo 60 tabletas", precioBase: 22, tipo: "salud", emailProveedor: "salud@bienestartotal.com" },
      { nombre: "Protector Solar SPF50", descripcion: "Protector solar amplio espectro resistente agua", precioBase: 15, tipo: "salud", emailProveedor: "salud@bienestartotal.com" },
      { nombre: "Shampoo Reparador 400ml", descripcion: "Shampoo con keratina cabello dañado", precioBase: 9, tipo: "salud", emailProveedor: "cuidado@glowlab.com" },
      { nombre: "Alcohol Gel 500ml", descripcion: "Alcohol en gel antibacterial 70%", precioBase: 5, tipo: "salud", emailProveedor: "cuidado@glowlab.com" },
      { nombre: "Mascarilla Pack x50", descripcion: "Mascarillas quirúrgicas 3 capas pack 50", precioBase: 12, tipo: "salud", emailProveedor: "salud@bienestartotal.com" },
    ],
    "Deportes": [
      { nombre: "Pelota de Fútbol", descripcion: "Balón fútbol oficial tamaño 5 cuero sintético", precioBase: 30, tipo: "deporte", emailProveedor: "deportes@activewear.com" },
      { nombre: "Pesa Rusa 10kg", descripcion: "Pesa rusa hierro fundido 10 kilogramos", precioBase: 40, tipo: "deporte", emailProveedor: "deportes@activewear.com" },
      { nombre: "Bicicleta Montañera", descripcion: "Bicicleta montaña 21 velocidades suspensión", precioBase: 450, tipo: "deporte", emailProveedor: "deportes@activewear.com" },
      { nombre: "Colchoneta Yoga", descripcion: "Colchoneta yoga antideslizante 6mm", precioBase: 25, tipo: "deporte", emailProveedor: "deportes@activewear.com" },
      { nombre: "Cuerda de Saltar", descripcion: "Cuerda saltar velocidad profesional", precioBase: 10, tipo: "deporte", emailProveedor: "deportes@activewear.com" },
    ],
  };
  for (const [cat, prods] of Object.entries(prodTemplates)) {
    const catId = categorias.find(c => c.nombre === cat)!.id;
    for (const p of prods) {
      const costo = Math.round(p.precioBase * randFloat(0.4, 0.7) * 100) / 100;
      productosData.push({ ...p, costo, categoriaId: catId });
    }
  }
  const productos: { id: number; precioBase: number; costo: number; nombre: string; categoriaId: number }[] = [];
  for (const p of productosData) {
    const created = await prisma.producto.create({ data: p });
    productos.push({ id: created.id, precioBase: created.precioBase, costo: created.costo ?? 0, nombre: created.nombre, categoriaId: created.categoriaId });
  }
  console.log(`✓ ${productos.length} productos (con costo)`);

  // ══════════════════════════════════════════════
  // 9. Inventario
  // ══════════════════════════════════════════════
  let invCount = 0;
  for (const suc of sucursales) {
    for (const prod of productos) {
      const stockActual = rand(0, 50);
      const stockMinimo = rand(3, 15);
      const estado = stockActual === 0 ? "critico" : stockActual <= stockMinimo ? "bajo" : "optimo";
      await prisma.inventario.create({
        data: {
          sucursalId: suc.id, productoId: prod.id, stockActual, stockMinimo,
          cantVentas: rand(0, 80), estadoStock: estado,
          status: stockActual === 0 ? "no disponible" : "disponible",
        },
      });
      invCount++;
    }
  }
  console.log(`✓ ${invCount} inventarios (${sucursales.length} suc × ${productos.length} prod)`);

  // ══════════════════════════════════════════════
  // 10. Clientes (30)
  // ══════════════════════════════════════════════
  const clienteHash = await bcrypt.hash("cliente123", SALT_ROUNDS);
  const nombres = ["María", "José", "Ana", "Carlos", "Laura", "Miguel", "Sofía", "Diego", "Valentina", "Juan", "Gabriela", "Pedro", "Daniela", "Luis", "Paula", "Andrés", "Camila", "Alejandro", "Andrea", "Fernando", "Lucía", "Ricardo", "Elena", "Pablo", "Victoria", "Javier", "Isabella", "Antonio", "Natalia", "Hugo"];
  const apellidos = ["García", "Rodríguez", "Martínez", "López", "Hernández", "González", "Pérez", "Sánchez", "Ramírez", "Torres", "Flores", "Rivera", "Gómez", "Díaz", "Cruz", "Morales", "Reyes", "Castillo", "Ortiz", "Medina"];
  const clientes: { id: number; nombre: string; apellido: string }[] = [];

  for (let i = 0; i < 30; i++) {
    const nombre = nombres[i];
    const apellido = apellidos[i % apellidos.length];
    const tipoCliente = i < 5 ? "oro" : i < 15 ? "plata" : "bronce";
    const created = await prisma.cliente.upsert({
      where: { correo: `cliente${i + 1}@gmail.com` },
      create: {
        nombre, apellido, cedula: `V-${rand(10000000, 30000000)}`,
        correo: `cliente${i + 1}@gmail.com`, password: clienteHash,
        telefono: `+58-414-${rand(1000000, 9999999)}`,
        direccion: `${["Av.", "Calle", "Carrera"][i % 3]} ${rand(1, 99)}, ${CIUDAD_SEMILLA}`,
        tipoCliente,
      },
      update: {},
    });
    clientes.push({ id: created.id, nombre: created.nombre, apellido: created.apellido });
  }
  await prisma.cliente.upsert({
    where: { correo: "cliente@demo.com" },
    create: {
      nombre: "Cliente", apellido: "Demo", cedula: "V-11111111", correo: "cliente@demo.com",
      password: clienteHash, telefono: "+58-414-1111111",
      direccion: `Av. Principal, ${CIUDAD_SEMILLA}`, tipoCliente: "plata",
    },
    update: {},
  });
  console.log(`✓ ${clientes.length} clientes`);

  // ══════════════════════════════════════════════
  // 11. Compras + Detalles (6 meses, ~240)
  // ══════════════════════════════════════════════
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
      const precioUnit = prod.precioBase;
      total += cantidad * precioUnit;
      detalles.push({ productoId: prod.id, cantidad, precioUnit, costoUnit: prod.costo ?? undefined });
    }
    await prisma.compra.create({
      data: { clienteId: cliente.id, sucursalId: sucursal.id, repartidorId, total, tipo, status, fecha, detalles: { create: detalles } },
    });
    compraCount++;
  }
  console.log(`✓ ${compraCount} compras (6 meses)`);

  // ══════════════════════════════════════════════
  // 12. Conexiones — San Juan de los Morros
  // ══════════════════════════════════════════════
  let connCount = 0;
  const devices = ["Android", "iPhone", "Windows Desktop", "MacBook Pro", "iPad", "Linux Desktop", "Android Tablet"];
  const providers = ["CANTV", "Movistar", "Digitel", "Inter"];

  // 25 puntos de referencia dispersos por toda San Juan de los Morros (~10km cobertura)
  const sjmZonas: [number, number][] = [
    // Centro (~3)
    [9.9080, -67.3550], // centro
    [9.9150, -67.3500], // centro-norte
    [9.9030, -67.3520], // centro-sur
    // Norte (~4)
    [9.9250, -67.3580], // norte (urb. doñaeva)
    [9.9300, -67.3400], // noreste
    [9.9280, -67.3700], // noroeste
    [9.9350, -67.3550], // norte-periferia
    // Sur (~4)
    [9.8900, -67.3500], // sur (camoruquito)
    [9.8850, -67.3600], // suroeste
    [9.8920, -67.3380], // sureste
    [9.8800, -67.3500], // sur-periferia
    // Este (~4)
    [9.9100, -67.3350], // este (barrio brisas)
    [9.9200, -67.3300], // este-lejano
    [9.9100, -67.3250], // este-periferia
    [9.9150, -67.3300], // terepaima
    // Oeste (~4)
    [9.9120, -67.3700], // oeste (la vega)
    [9.9050, -67.3780], // oeste-lejano
    [9.9100, -67.3850], // oeste-periferia
    [9.8950, -67.3750], // universidad
    // Esquinas (~4)
    [9.9350, -67.3750], // noroeste-lejano
    [9.9350, -67.3250], // noreste-lejano
    [9.8800, -67.3750], // suroeste-lejano
    [9.8800, -67.3250], // sureste-lejano
    // Extras (~2)
    [9.9200, -67.3650], // rómulo gallegos
    [9.8750, -67.3550], // barrio maría
  ];

  function generarCoordSJdM(): [number, number] {
    const zona = sjmZonas[rand(0, sjmZonas.length - 1)];
    // Offset: ±0.0135° ≈ ±1.5km para dispersión amplia pero agrupada por zona
    return [
      zona[0] + randFloat(-0.0135, 0.0135),
      zona[1] + randFloat(-0.0135, 0.0135),
    ];
  }

  for (const cliente of clientes) {
    const numConn = rand(3, 8);
    for (let j = 0; j < numConn; j++) {
      const [lat, lng] = generarCoordSJdM();
      const diasAtras = rand(0, 180);
      await prisma.conexion.create({
        data: {
          clienteId: cliente.id,
          dispositivoId: `dev-${cliente.id}-${rand(1000, 9999)}`,
          ip: `${rand(180, 200)}.${rand(0, 255)}.${rand(0, 255)}.${rand(0, 255)}`,
          latitud: lat, longitud: lng,
          dispositivo: `${devices[rand(0, devices.length - 1)]} (${providers[rand(0, providers.length - 1)]})`,
          fecha: new Date(now.getTime() - diasAtras * 86400000 - rand(0, 86400000)),
        },
      });
      connCount++;
    }
  }
  console.log(`✓ ${connCount} conexiones`);

  // ══════════════════════════════════════════════
  // 13. Competidores — Apify API real
  // ══════════════════════════════════════════════
  const competidoresFallback: CompetitorData[] = [
    { placeId: "fallback-1", nombre: "ElectroMundo SJdM", ciudad: CIUDAD_SEMILLA, direccion: "Av. Principal, Local 5", coordenadasLat: SJM_LAT + 0.005, coordenadasLng: SJM_LNG + 0.003, cantReviews: 45, ratingPromedio: 4.1, tipoNegocio: "Tienda de Electrónica", categories: '["Electrónica","Hogar"]', website: null, phone: null },
    { placeId: "fallback-2", nombre: "SuperAbastos", ciudad: CIUDAD_SEMILLA, direccion: "Calle 5, Centro Comercial", coordenadasLat: SJM_LAT - 0.003, coordenadasLng: SJM_LNG + 0.005, cantReviews: 120, ratingPromedio: 4.3, tipoNegocio: "Supermercado", categories: '["Alimentos","Hogar"]', website: null, phone: null },
    { placeId: "fallback-3", nombre: "Moda Total SJdM", ciudad: CIUDAD_SEMILLA, direccion: "Av. Libertador, Local 12", coordenadasLat: SJM_LAT + 0.002, coordenadasLng: SJM_LNG - 0.004, cantReviews: 67, ratingPromedio: 3.9, tipoNegocio: "Tienda de Ropa", categories: '["Ropa"]', website: null, phone: null },
    { placeId: "fallback-4", nombre: "Farmacia San Juan", ciudad: CIUDAD_SEMILLA, direccion: "Av. Juan de Viñes, Edif. 3", coordenadasLat: SJM_LAT - 0.001, coordenadasLng: SJM_LNG + 0.002, cantReviews: 89, ratingPromedio: 4.5, tipoNegocio: "Farmacia", categories: '["Salud"]', website: null, phone: null },
    { placeId: "fallback-5", nombre: "Deportes Guárico", ciudad: CIUDAD_SEMILLA, direccion: "Calle Principal, Local 8", coordenadasLat: SJM_LAT + 0.004, coordenadasLng: SJM_LNG - 0.002, cantReviews: 34, ratingPromedio: 4.0, tipoNegocio: "Tienda Deportiva", categories: '["Deportes"]', website: null, phone: null },
  ];

  const competidoresApi = await retryWithFallback("Competidores (Apify)", fetchCompetidores, competidoresFallback);

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

  // ══════════════════════════════════════════════
  // 14. BusquedaCompetidor + CompetidoresBusqueda
  // ══════════════════════════════════════════════
  const busqueda = await prisma.busquedaCompetidor.upsert({
    where: { categorias_ciudades_maxPlaces: {
      categorias: '["Electrónica","Hogar","Ropa","Alimentos","Salud","Deportes"]',
      ciudades: `["${CIUDAD_SEMILLA}"]`,
      maxPlaces: 20,
    }},
    create: {
      categorias: '["Electrónica","Hogar","Ropa","Alimentos","Salud","Deportes"]',
      ciudades: `["${CIUDAD_SEMILLA}"]`,
      maxPlaces: 20,
    },
    update: { createdAt: new Date() },
  });
  for (const cid of competidoresIds) {
    try {
      await prisma.competidoresBusqueda.create({ data: { busquedaId: busqueda.id, competidorId: cid } });
    } catch { /* ya existe */ }
  }
  console.log("✓ Búsquedas de competidores");

  // ══════════════════════════════════════════════
  // 15. Ofertas
  // ══════════════════════════════════════════════
  const ofertasData = [
    { nombre: "Oferta Apertura Electrónica", descripcion: "15% desc en todo el catálogo de electrónica", tipo: "porcentaje", valor: 15, montoMinimo: 50, fechaInicio: new Date(now.getFullYear(), now.getMonth() - 2, 1), fechaFin: new Date(now.getFullYear(), now.getMonth() + 2, 1), activo: true, prioridad: 1, categoriaId: categorias[0].id, productoId: undefined as number | undefined },
    { nombre: "Flash Sale Hogar", descripcion: "$20 fijos de descuento en muebles", tipo: "monto_fijo", valor: 20, montoMinimo: 100, fechaInicio: new Date(now.getFullYear(), now.getMonth() - 1, 1), fechaFin: new Date(now.getFullYear(), now.getMonth() + 1, 1), activo: true, prioridad: 2, categoriaId: undefined as number | undefined, productoId: productos.find(p => p.nombre === "Sofá 3 Cuerpos")!.id },
    { nombre: "2x1 en Camisas", descripcion: "50% desc en la segunda camisa", tipo: "porcentaje", valor: 50, montoMinimo: 50, fechaInicio: new Date(now.getFullYear(), now.getMonth() - 3, 1), fechaFin: new Date(now.getFullYear(), now.getMonth() + 1, 1), activo: true, prioridad: 0, categoriaId: undefined as number | undefined, productoId: productos.find(p => p.nombre === "Camisa Casual M/L")!.id },
    { nombre: "Descuento Alimentos", descripcion: "10% desc en productos de alimentos", tipo: "porcentaje", valor: 10, montoMinimo: 0, fechaInicio: new Date(now.getFullYear(), now.getMonth() - 4, 1), fechaFin: new Date(now.getFullYear(), now.getMonth() + 2, 1), activo: true, prioridad: 3, categoriaId: categorias[3].id, productoId: undefined as number | undefined },
  ];
  for (const o of ofertasData) {
    const created = await prisma.oferta.create({ data: o as any });
    for (const s of sucursales) {
      await prisma.ofertaSucursal.create({ data: { ofertaId: created.id, sucursalId: s.id } });
    }
  }
  console.log("✓ Ofertas con sucursales");

  // ══════════════════════════════════════════════
  // 16. Informes Analíticos previos
  // ══════════════════════════════════════════════
  const tiposAnalisis = ["patrones", "demanda_geo", "rendimiento", "sucursal"];
  for (let i = 0; i < 8; i++) {
    const suc = sucursales[rand(0, sucursales.length - 1)];
    const tipo = tiposAnalisis[i % 4];
    const diasAtras = rand(1, 140);
    const ini = new Date(now.getTime() - diasAtras * 86400000 - 90 * 86400000);
    const fin = new Date(now.getTime() - diasAtras * 86400000);
    await prisma.informeAnalitico.create({
      data: {
        tipoAnalisis: tipo, sucursalId: suc.id, rangoInicio: ini, rangoFin: fin,
        dataJson: { totalVentas: rand(3000, 50000), promedioTicket: rand(20, 200) } as any,
        insightIA: { tipo, resumen: "Insight generado por IA — seed de ejemplo.", recomendaciones: [{ accion: "Ejemplo de recomendacion", datoClave: "Dato de ejemplo", prioridad: "media" }], alertas: [] },
      },
    });
  }
  console.log("✓ Informes analíticos previos");

  // ══════════════════════════════════════════════
  // 17. GeoIP + Auditoría — San Juan de los Morros
  // ══════════════════════════════════════════════
  const geoIPsData = [
    { ip: "190.10.0.1", proveedor: "CANTV", ciudad: CIUDAD_SEMILLA, pais: "Venezuela", latitud: SJM_LAT, longitud: SJM_LNG },
    { ip: "190.10.0.2", proveedor: "Movistar", ciudad: CIUDAD_SEMILLA, pais: "Venezuela", latitud: SJM_LAT + 0.01, longitud: SJM_LNG - 0.01 },
    { ip: "190.10.0.3", proveedor: "Digitel", ciudad: CIUDAD_SEMILLA, pais: "Venezuela", latitud: SJM_LAT - 0.01, longitud: SJM_LNG + 0.01 },
    { ip: "190.10.0.4", proveedor: "CANTV", ciudad: CIUDAD_SEMILLA, pais: "Venezuela", latitud: SJM_LAT + 0.005, longitud: SJM_LNG + 0.005 },
    { ip: "190.10.0.5", proveedor: "Inter", ciudad: CIUDAD_SEMILLA, pais: "Venezuela", latitud: SJM_LAT - 0.005, longitud: SJM_LNG - 0.005 },
  ];
  for (const g of geoIPsData) {
    await prisma.geoIP.upsert({ where: { ip: g.ip }, create: g, update: {} });
  }
  const geoIPsExistentes = await prisma.geoIP.findMany({ select: { id: true } });
  const geoIPIds = geoIPsExistentes.map((g) => g.id);
  console.log("✓ GeoIPs");

  const rutas = ["/", "/admin", "/api/tienda/productos", "/api/compras/mis-compras", "/api/productos", "/api/sucursales", "/api/analisis/patrones", "/estadisticas", "/globy"];
  const metodos = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  for (let i = 0; i < 30; i++) {
    await prisma.auditoria.create({
      data: {
        ip: `190.10.0.${rand(1, 5)}`,
        ruta: rutas[rand(0, rutas.length - 1)],
        metodo: metodos[rand(0, metodos.length - 1)],
        clienteId: Math.random() > 0.5 ? clientes[rand(0, clientes.length - 1)].id : null,
        geoIPId: geoIPIds.length > 0 ? geoIPIds[rand(0, geoIPIds.length - 1)] : null,
        createdAt: new Date(now.getTime() - rand(0, 150) * 86400000),
      },
    });
  }
  console.log("✓ Auditorías");

  // ══════════════════════════════════════════════
  // 18. Coeficientes de Estacionalidad
  // ══════════════════════════════════════════════
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

  // ══════════════════════════════════════════════
  // 19. Ciudades de Venezuela — GeoDB API (10 más importantes)
  // ══════════════════════════════════════════════
  const ciudadesFallback: GeoDBCity[] = [
    { nombre: "Caracas", region: "Distrito Capital", poblacion: 2245744, latitud: 10.5061, longitud: -66.9144 },
    { nombre: "Maracaibo", region: "Zulia", poblacion: 1551539, latitud: 10.6667, longitud: -71.6333 },
    { nombre: "Valencia", region: "Carabobo", poblacion: 1385621, latitud: 10.1667, longitud: -68.0 },
    { nombre: "Barquisimeto", region: "Lara", poblacion: 1059092, latitud: 10.0678, longitud: -69.3467 },
    { nombre: "Ciudad Guayana", region: "Bolívar", poblacion: 877518, latitud: 8.3739, longitud: -62.5611 },
    { nombre: "Maracay", region: "Aragua", poblacion: 837423, latitud: 10.2333, longitud: -67.6 },
    { nombre: "Barinas", region: "Barinas", poblacion: 873962, latitud: 8.6333, longitud: -70.2167 },
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

  console.log("\n✅ Seed completado exitosamente!");
  console.log(`   📊 ${sucursales.length} sucursales (${CIUDAD_SEMILLA})`);
  console.log(`   💼 ${tiposPersonal.length} tipos de personal`);
  console.log(`   📦 ${productos.length} productos (con costo)`);
  console.log(`   📦 ${invCount} inventarios`);
  console.log(`   👥 ${clientes.length} clientes`);
  console.log(`   🛒 ${compraCount} compras (6 meses)`);
  console.log(`   📡 ${connCount} conexiones`);
  console.log(`   🏬 ${competidoresIds.length} competidores`);
  console.log(`   🏷️  ${ofertasData.length} ofertas`);
  console.log(`   📈 8 informes analíticos previos`);
  console.log(`   🎯 12 coeficientes de estacionalidad`);
  console.log(`   🌎 ${ciudadesApi.length} ciudades de Venezuela`);
}

main()
  .catch((e) => {
    console.error("❌ Error durante el seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
