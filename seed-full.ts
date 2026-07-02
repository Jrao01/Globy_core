import { PrismaClient } from "./src/generated/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcrypt";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});

const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 10;

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min: number, max: number) { return Math.round((min + Math.random() * (max - min)) * 100) / 100; }

async function main() {
  console.log("🌱 Seeding database with 6 months of activity, 3 sucursales, costos y tipos de personal...\n");

  // ── 1. EmpresaConfig ──
  await prisma.empresaConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      nombreEmpresa: "Globy",
      rif: "J-30336715-9",
      direccionFiscal: "Barrio San Miguelito, Casa #7",
      telefono: "+58-414-5888840",
      logoUrl: null,
      pais: "Venezuela",
      colorPrimario: "#5713be",
      bannerImg: null,
      bannerTitle: "Bienvenido a Globy",
      bannerSubtitle: "Explora nuestro catálogo de productos y realiza tus pedidos de forma rápida y sencilla",
      smtpHost: null,
      smtpPort: null,
      smtpUser: null,
      smtpPass: null,
    },
    update: {},
  });
  console.log("✓ EmpresaConfig");

  // ── 2. GestionEconomica ──
  await prisma.gestionEconomica.upsert({
    where: { id: 1 },
    create: { id: 1, monedaPrincipal: "USD", autoUpdate: true },
    update: {},
  });
  console.log("✓ GestionEconomica");

  // ── 3. Tasas de Cambio (histórico 6 meses) ──
  const now = new Date();
  for (let m = 5; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 15);
    await prisma.tasaCambio.create({ data: { moneda: "USD", precio: randFloat(54, 65), fecha: d } });
    await prisma.tasaCambio.create({ data: { moneda: "EUR", precio: randFloat(58, 70), fecha: d } });
  }
  console.log("✓ Tasas de Cambio (12 registros)");

  // ── 4. Sucursales (3) ──
  const sucursalesData = [
    { nombre: "Sucursal Principal Caracas", ciudad: "Caracas", direccion: "Av. Bolívar, CC Los Chaguaramos, Local 1", coordenadasLat: 10.4806, coordenadasLng: -66.9036, tipo: "principal" },
    { nombre: "Sucursal Maracaibo", ciudad: "Maracaibo", direccion: "Calle 77, Edif. Maracaibo Center, PB", coordenadasLat: 10.6317, coordenadasLng: -71.6403, tipo: "secundaria" },
    { nombre: "Sucursal Valencia", ciudad: "Valencia", direccion: "Av. Bolívar Norte, CC Metropolitano, Nivel 2", coordenadasLat: 10.1621, coordenadasLng: -68.0024, tipo: "secundaria" },
  ];
  const sucursales: { id: number; ciudad: string; nombre: string }[] = [];
  for (const s of sucursalesData) {
    const created = await prisma.sucursal.create({ data: s });
    sucursales.push({ id: created.id, ciudad: created.ciudad, nombre: created.nombre });
  }
  console.log(`✓ ${sucursales.length} sucursales`);

  // ── 5. TipoPersonal (sueldos por rol) ──
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

  // ── 6. Personal ──
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
    { nombre: "Gerente", apellido: "Caracas", cedula: "V-10000001", correo: "gerente.caracas@gmail.com", password: "gerente123", sucursalId: sucursales[0].id, tipoPersonalId: tiposPersonal.find(t => t.nombre === "gerente")!.id },
    { nombre: "Gerente", apellido: "Maracaibo", cedula: "V-10000002", correo: "gerente.maracaibo@gmail.com", password: "gerente123", sucursalId: sucursales[1].id, tipoPersonalId: tiposPersonal.find(t => t.nombre === "gerente")!.id },
    { nombre: "Gerente", apellido: "Valencia", cedula: "V-10000003", correo: "gerente.valencia@gmail.com", password: "gerente123", sucursalId: sucursales[2].id, tipoPersonalId: tiposPersonal.find(t => t.nombre === "gerente")!.id },
  ];
  for (const g of gerentesData) {
    const hashed = await bcrypt.hash(g.password, SALT_ROUNDS);
    await prisma.personal.upsert({ where: { correo: g.correo }, create: { ...g, password: hashed, rol: "gerente" }, update: {} });
  }
  const deliveryUser = await prisma.personal.findUniqueOrThrow({ where: { correo: "delivery@gmail.com" } });
  console.log("✓ Personal (7 usuarios)");

  // ── 6. Categorías ──
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

  // ── 7. Productos (30) ──
  const productosData: { nombre: string; tipo: string; descripcion: string; precioBase: number; costo: number; emailProveedor: string; categoriaId: number }[] = [];
  const catAlias = ["Electrónica", "Hogar", "Ropa", "Alimentos", "Salud", "Deportes"];

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

  // ── 8. Inventario (cada sucursal tiene stock de TODOS los productos) ──
  let invCount = 0;
  for (const suc of sucursales) {
    for (const prod of productos) {
      const stockActual = rand(0, 50);
      const stockMinimo = rand(3, 15);
      const estado = stockActual === 0 ? "critico" : stockActual <= stockMinimo ? "bajo" : "optimo";
      await prisma.inventario.create({
        data: {
          sucursalId: suc.id,
          productoId: prod.id,
          stockActual,
          stockMinimo,
          cantVentas: rand(0, 80),
          estadoStock: estado,
          status: stockActual === 0 ? "no disponible" : "disponible",
        },
      });
      invCount++;
    }
  }
  console.log(`✓ ${invCount} inventarios (${sucursales.length} suc × ${productos.length} prod)`);

  // ── 9. Clientes (30) ──
  const clienteHash = await bcrypt.hash("cliente123", SALT_ROUNDS);
  const nombres = ["María", "José", "Ana", "Carlos", "Laura", "Miguel", "Sofía", "Diego", "Valentina", "Juan", "Gabriela", "Pedro", "Daniela", "Luis", "Paula", "Andrés", "Camila", "Alejandro", "Andrea", "Fernando", "Lucía", "Ricardo", "Elena", "Pablo", "Victoria", "Javier", "Isabella", "Antonio", "Natalia", "Hugo"];
  const apellidos = ["García", "Rodríguez", "Martínez", "López", "Hernández", "González", "Pérez", "Sánchez", "Ramírez", "Torres", "Flores", "Rivera", "Gómez", "Díaz", "Cruz", "Morales", "Reyes", "Castillo", "Ortiz", "Medina"];
  const ciudades = ["Caracas", "Maracaibo", "Valencia"];
  const clientes: { id: number; nombre: string; apellido: string }[] = [];

  for (let i = 0; i < 30; i++) {
    const nombre = nombres[i];
    const apellido = apellidos[i % apellidos.length];
    const ciudad = ciudades[i % 3];
    const tipoCliente = i < 5 ? "oro" : i < 15 ? "plata" : "bronce";
    const created = await prisma.cliente.upsert({
      where: { correo: `cliente${i + 1}@gmail.com` },
      create: {
        nombre,
        apellido,
        cedula: `V-${rand(10000000, 30000000)}`,
        correo: `cliente${i + 1}@gmail.com`,
        password: clienteHash,
        telefono: `+58-414-${rand(1000000, 9999999)}`,
        direccion: `${["Av.", "Calle", "Carrera"][i % 3]} ${rand(1, 99)}, ${ciudad}`,
        tipoCliente,
      },
      update: {},
    });
    clientes.push({ id: created.id, nombre: created.nombre, apellido: created.apellido });
  }
  // También crear el cliente de prueba del login de tienda
  await prisma.cliente.upsert({
    where: { correo: "cliente@demo.com" },
    create: {
      nombre: "Cliente", apellido: "Demo", cedula: "V-11111111", correo: "cliente@demo.com",
      password: clienteHash, telefono: "+58-414-1111111", direccion: "Av. Principal, Caracas", tipoCliente: "plata",
    },
    update: {},
  });
  console.log(`✓ ${clientes.length} clientes`);

  // ── 10. Compras + Detalles (6 meses de actividad, ~240 compras) ──
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
      data: {
        clienteId: cliente.id,
        sucursalId: sucursal.id,
        repartidorId,
        total,
        tipo,
        status,
        fecha,
        detalles: { create: detalles },
      },
    });
    compraCount++;
  }
  console.log(`✓ ${compraCount} compras (6 meses)`);

  // ── 11. Conexiones (3-8 por cliente, coordenadas de las 3 sucursales) ──
  let connCount = 0;
  const devices = ["Android", "iPhone", "Windows Desktop", "MacBook Pro", "iPad", "Linux Desktop", "Android Tablet"];
  const providers = ["CANTV", "Movistar", "Digitel", "Inter"];
  const venezuelaCoords: [number, number, string][] = [
    [10.4806, -66.9036, "Caracas"],
    [10.4880, -66.8500, "Caracas Este"],
    [10.4700, -66.9600, "Caracas Oeste"],
    [10.5000, -66.8800, "Caracas Centro"],
    [10.6317, -71.6403, "Maracaibo"],
    [10.6400, -71.6300, "Maracaibo Norte"],
    [10.6200, -71.6500, "Maracaibo Sur"],
    [10.1621, -68.0024, "Valencia"],
    [10.1700, -67.9900, "Valencia Este"],
    [10.1550, -68.0100, "Valencia Oeste"],
  ];

  for (const cliente of clientes) {
    const numConn = rand(3, 8);
    for (let j = 0; j < numConn; j++) {
      const coord = venezuelaCoords[rand(0, venezuelaCoords.length - 1)];
      const lat = coord[0] + randFloat(-0.05, 0.05);
      const lng = coord[1] + randFloat(-0.05, 0.05);
      const diasAtras = rand(0, 180);
      await prisma.conexion.create({
        data: {
          clienteId: cliente.id,
          dispositivoId: `dev-${cliente.id}-${rand(1000, 9999)}`,
          ip: `${rand(180, 200)}.${rand(0, 255)}.${rand(0, 255)}.${rand(0, 255)}`,
          latitud: lat,
          longitud: lng,
          dispositivo: `${devices[rand(0, devices.length - 1)]} (${providers[rand(0, providers.length - 1)]})`,
          fecha: new Date(now.getTime() - diasAtras * 86400000 - rand(0, 86400000)),
        },
      });
      connCount++;
    }
  }
  console.log(`✓ ${connCount} conexiones`);

  // ── 12. Competidores (solo 3 ciudades) ──
  const competidoresData = [
    { nombre: "ElectroMundo C.A.", ciudad: "Caracas", direccion: "CC Sambil, Nivel 2", coordenadasLat: 10.4961, coordenadasLng: -66.8442, cantReviews: 230, ratingPromedio: 4.2, tipoNegocio: "Tienda de Electrónica", categories: '["Electrónica","Hogar"]', placeId: "ChIJ-caracas-1", website: "https://electromundo.com", phone: "+58-212-555-1000" },
    { nombre: "TechShop Venezuela", ciudad: "Caracas", direccion: "Av. Libertador, Edif. Tech", coordenadasLat: 10.4880, coordenadasLng: -66.8730, cantReviews: 150, ratingPromedio: 4.5, tipoNegocio: "Tecnología", categories: '["Electrónica"]', placeId: "ChIJ-caracas-2", website: "https://techshop.co.ve", phone: "+58-212-555-2000" },
    { nombre: "Hogar & Estilo", ciudad: "Caracas", direccion: "CC El Recreo, Nivel 3", coordenadasLat: 10.4920, coordenadasLng: -66.8600, cantReviews: 95, ratingPromedio: 4.1, tipoNegocio: "Decoración", categories: '["Hogar"]', placeId: "ChIJ-caracas-3", website: "https://hogaryestilo.com", phone: "+58-212-555-6000" },
    { nombre: "MegaElectro", ciudad: "Maracaibo", direccion: "Calle 72, CC Galerías", coordenadasLat: 10.6350, coordenadasLng: -71.6450, cantReviews: 85, ratingPromedio: 3.8, tipoNegocio: "Electrodomésticos", categories: '["Hogar","Electrónica"]', placeId: "ChIJ-maracaibo-1", website: "https://megaelectro.com", phone: "+58-261-555-3000" },
    { nombre: "ModaExpress", ciudad: "Maracaibo", direccion: "CC Lago Mall, Local 15", coordenadasLat: 10.6380, coordenadasLng: -71.6380, cantReviews: 180, ratingPromedio: 3.9, tipoNegocio: "Ropa y Accesorios", categories: '["Ropa"]', placeId: "ChIJ-maracaibo-2", website: "https://modaexpress.com", phone: "+58-261-555-7000" },
    { nombre: "Deportes Extremos", ciudad: "Valencia", direccion: "CC Metropolitano, Nivel 1", coordenadasLat: 10.1600, coordenadasLng: -68.0000, cantReviews: 120, ratingPromedio: 4.0, tipoNegocio: "Tienda Deportiva", categories: '["Deportes"]', placeId: "ChIJ-valencia-1", website: "https://deportesextremos.com", phone: "+58-241-555-4000" },
    { nombre: "SuperAlimentos", ciudad: "Valencia", direccion: "Av. Bolívar Sur, Local 10", coordenadasLat: 10.1550, coordenadasLng: -68.0050, cantReviews: 310, ratingPromedio: 4.3, tipoNegocio: "Supermercado", categories: '["Alimentos"]', placeId: "ChIJ-valencia-2", website: "https://superalimentos.com", phone: "+58-241-555-8000" },
  ];
  const competidoresIds: number[] = [];
  for (const c of competidoresData) {
    const created = await prisma.competidor.upsert({ where: { placeId: c.placeId }, create: c, update: {} });
    competidoresIds.push(created.id);
  }
  console.log(`✓ ${competidoresIds.length} competidores`);

  // ── 13. BusquedaCompetidor + CompetidoresBusqueda ──
  const busquedasData = [
    { categorias: '["Electrónica"]', ciudades: '["Caracas"]', maxPlaces: 5, indices: [0, 1] },
    { categorias: '["Hogar"]', ciudades: '["Caracas","Maracaibo"]', maxPlaces: 5, indices: [2, 3] },
    { categorias: '["Deportes"]', ciudades: '["Valencia"]', maxPlaces: 5, indices: [5] },
    { categorias: '["Alimentos"]', ciudades: '["Valencia"]', maxPlaces: 5, indices: [6] },
    { categorias: '["Ropa"]', ciudades: '["Maracaibo"]', maxPlaces: 5, indices: [4] },
  ];
  for (const b of busquedasData) {
    const busqueda = await prisma.busquedaCompetidor.upsert({
      where: { categorias_ciudades_maxPlaces: { categorias: b.categorias, ciudades: b.ciudades, maxPlaces: b.maxPlaces } },
      create: { categorias: b.categorias, ciudades: b.ciudades, maxPlaces: b.maxPlaces },
      update: {},
    });
    for (const idx of b.indices) {
      try {
        await prisma.competidoresBusqueda.create({
          data: { busquedaId: busqueda.id, competidorId: competidoresIds[idx] },
        });
      } catch { /* ya existe */ }
    }
  }
  console.log("✓ Búsquedas de competidores");

  // ── 14. Ofertas (promociones activas) ──
  const ofertasData = [
    { nombre: "Oferta Apertura Electrónica", descripcion: "15% desc en todo el catálogo de electrónica", tipo: "porcentaje", valor: 15, montoMinimo: 50, fechaInicio: new Date(now.getFullYear(), now.getMonth() - 2, 1), fechaFin: new Date(now.getFullYear(), now.getMonth() + 2, 1), activo: true, prioridad: 1, categoriaId: categorias[0].id, productoId: undefined as number | undefined },
    { nombre: "Flash Sale Hogar", descripcion: "$20 fijos de descuento en muebles", tipo: "monto_fijo", valor: 20, montoMinimo: 100, fechaInicio: new Date(now.getFullYear(), now.getMonth() - 1, 1), fechaFin: new Date(now.getFullYear(), now.getMonth() + 1, 1), activo: true, prioridad: 2, categoriaId: undefined as number | undefined, productoId: productos.find(p => p.nombre === "Sofá 3 Cuerpos")!.id },
    { nombre: "2x1 en Camisas", descripcion: "50% desc en la segunda camisa", tipo: "porcentaje", valor: 50, montoMinimo: 50, fechaInicio: new Date(now.getFullYear(), now.getMonth() - 3, 1), fechaFin: new Date(now.getFullYear(), now.getMonth() + 1, 1), activo: true, prioridad: 0, categoriaId: undefined as number | undefined, productoId: productos.find(p => p.nombre === "Camisa Casual M/L")!.id },
    { nombre: "Descuento Alimentos", descripcion: "10% desc en productos de alimentos", tipo: "porcentaje", valor: 10, montoMinimo: 0, fechaInicio: new Date(now.getFullYear(), now.getMonth() - 4, 1), fechaFin: new Date(now.getFullYear(), now.getMonth() + 2, 1), activo: true, prioridad: 3, categoriaId: categorias[3].id, productoId: undefined as number | undefined },
  ];
  for (const o of ofertasData) {
    const created = await prisma.oferta.create({ data: o as any });
    // Asignar a todas las sucursales
    for (const s of sucursales) {
      await prisma.ofertaSucursal.create({ data: { ofertaId: created.id, sucursalId: s.id } });
    }
  }
  console.log("✓ Ofertas con sucursales");

  // ── 15. Informes Analíticos (histórico) ──
  const tiposAnalisis = ["patrones", "demanda_geo", "rendimiento", "sucursal"];
  for (let i = 0; i < 8; i++) {
    const suc = sucursales[rand(0, sucursales.length - 1)];
    const tipo = tiposAnalisis[i % 4];
    const diasAtras = rand(1, 140);
    const ini = new Date(now.getTime() - diasAtras * 86400000 - 90 * 86400000);
    const fin = new Date(now.getTime() - diasAtras * 86400000);
    await prisma.informeAnalitico.create({
      data: {
        tipoAnalisis: tipo,
        sucursalId: suc.id,
        rangoInicio: ini,
        rangoFin: fin,
        dataJson: { totalVentas: rand(3000, 50000), promedioTicket: rand(20, 200) } as any,
        insightIA: "Insight generado por IA — seed de ejemplo.",
      },
    });
  }
  console.log("✓ Informes analíticos previos");

  // ── 16. GeoIP + Auditoría ──
  const geoIPsData = [
    { ip: "190.10.0.1", proveedor: "CANTV", ciudad: "Caracas", pais: "Venezuela", latitud: 10.4806, longitud: -66.9036 },
    { ip: "190.10.0.2", proveedor: "Movistar", ciudad: "Maracaibo", pais: "Venezuela", latitud: 10.6317, longitud: -71.6403 },
    { ip: "190.10.0.3", proveedor: "Digitel", ciudad: "Valencia", pais: "Venezuela", latitud: 10.1621, longitud: -68.0024 },
    { ip: "190.10.0.4", proveedor: "CANTV", ciudad: "Barquisimeto", pais: "Venezuela", latitud: 10.0731, longitud: -69.3227 },
    { ip: "190.10.0.5", proveedor: "Inter", ciudad: "Puerto Ordaz", pais: "Venezuela", latitud: 8.3053, longitud: -62.7161 },
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

  console.log("\n✅ Seed completado exitosamente!");
  console.log(`   📊 ${sucursales.length} sucursales`);
  console.log(`   💼 ${tiposPersonal.length} tipos de personal`);
  console.log(`   📦 ${productos.length} productos (con costo)`);
  console.log(`   📦 ${invCount} inventarios`);
  console.log(`   👥 ${clientes.length} clientes`);
  console.log(`   🛒 ${compraCount} compras (6 meses)`);
  console.log(`   📡 ${connCount} conexiones`);
  console.log(`   🏬 ${competidoresIds.length} competidores`);
  console.log(`   🏷️  ${ofertasData.length} ofertas`);
  console.log(`   📈 8 informes analíticos previos`);
}

main()
  .catch((e) => {
    console.error("❌ Error durante el seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
