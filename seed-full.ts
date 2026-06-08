import { PrismaClient } from "./src/generated/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...\n");

  // ── 1. EmpresaConfig ──
  await prisma.empresaConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      nombreEmpresa: "InventPro C.A.",
      rif: "J-12345678-9",
      direccionFiscal: "Av. Principal, Edif. InventPro, Piso 3, Caracas",
      telefono: "+58-212-555-1234",
      logoUrl: null,
      pais: "Venezuela",
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      smtpUser: "notificaciones@inventpro.com",
      smtpPass: "smtp_pass_placeholder",
    },
    update: {},
  });
  console.log("✓ EmpresaConfig creada");

  // ── 2. GestionEconomica ──
  await prisma.gestionEconomica.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      monedaPrincipal: "USD",
      bcvPrice: 564.50,
      autoUpdate: true,
      updateFrequency: "24H",
      lastUpdate: new Date(),
    },
    update: {},
  });
  console.log("✓ GestionEconomica creada");

  // ── 3. Sucursales ──
  const sucursalesData = [
    { nombre: "Sucursal Principal Caracas", ciudad: "Caracas", direccion: "Av. Bolívar, Centro Comercial Los Chaguaramos, Local 1", coordenadasLat: 10.4806, coordenadasLng: -66.9036, tipo: "principal" },
    { nombre: "Sucursal Maracaibo", ciudad: "Maracaibo", direccion: "Calle 77, Edif. Maracaibo Center, PB", coordenadasLat: 10.6317, coordenadasLng: -71.6403, tipo: "secundaria" },
    { nombre: "Sucursal Valencia", ciudad: "Valencia", direccion: "Av. Bolívar Norte, CC Metropolitano, Nivel 2", coordenadasLat: 10.1621, coordenadasLng: -68.0024, tipo: "secundaria" },
    { nombre: "Sucursal Barquisimeto", ciudad: "Barquisimeto", direccion: "Carrera 19, entre calles 25 y 26, Local 3", coordenadasLat: 10.0731, coordenadasLng: -69.3227, tipo: "secundaria" },
    { nombre: "Sucursal Puerto Ordaz", ciudad: "Puerto Ordaz", direccion: "Av. Guayana, CC Alta Vista, Local 8", coordenadasLat: 8.3053, coordenadasLng: -62.7161, tipo: "secundaria" },
  ];
  const sucursales: { id: number; ciudad: string }[] = [];
  for (const s of sucursalesData) {
    const created = await prisma.sucursal.create({ data: s });
    sucursales.push({ id: created.id, ciudad: created.ciudad });
  }
  console.log(`✓ ${sucursales.length} sucursales creadas`);

  // ── 4. Personal (usuarios internos) ──
  const personalData = [
    { nombre: "Admin", apellido: "Principal", cedula: "V-00000001", correo: "admin@gmail.com", password: "admin123", telefono: "+58-212-555-0001", rol: "admin" as const },
    { nombre: "Trabajador", apellido: "Demo", cedula: "V-00000002", correo: "trabajador@gmail.com", password: "worker123", telefono: "+58-212-555-0002", rol: "trabajador" as const },
    { nombre: "Delivery", apellido: "Uno", cedula: "V-00000003", correo: "delivery@gmail.com", password: "delivery123", telefono: "+58-212-555-0003", rol: "delivery" as const },
  ];
  for (const p of personalData) {
    await prisma.personal.upsert({
      where: { correo: p.correo },
      create: p,
      update: {},
    });
  }
  console.log("✓ Personal admin/trabajador/delivery creado");

  // ── Personal gerente (1 por sucursal) ──
  const gerentesData = [
    { nombre: "Gerente", apellido: "Caracas", cedula: "V-10000001", correo: "gerente.caracas@gmail.com", password: "gerente123", telefono: "+58-212-555-1001", sucursalId: sucursales[0].id },
    { nombre: "Gerente", apellido: "Maracaibo", cedula: "V-10000002", correo: "gerente.maracaibo@gmail.com", password: "gerente123", telefono: "+58-261-555-1002", sucursalId: sucursales[1].id },
    { nombre: "Gerente", apellido: "Valencia", cedula: "V-10000003", correo: "gerente.valencia@gmail.com", password: "gerente123", telefono: "+58-241-555-1003", sucursalId: sucursales[2].id },
    { nombre: "Gerente", apellido: "Barquisimeto", cedula: "V-10000004", correo: "gerente.barquisimeto@gmail.com", password: "gerente123", telefono: "+58-251-555-1004", sucursalId: sucursales[3].id },
  ];
  for (const g of gerentesData) {
    await prisma.personal.upsert({
      where: { correo: g.correo },
      create: { ...g, rol: "gerente" },
      update: {},
    });
  }
  console.log("✓ Gerentes creados");

  // delivery para asignar a pedidos
  const deliveryUser = await prisma.personal.findUniqueOrThrow({ where: { correo: "delivery@gmail.com" } });

  // ── 5. Categorías ──
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
    const created = await prisma.categoria.upsert({
      where: { nombre: c.nombre },
      create: c,
      update: {},
    });
    categorias.push({ id: created.id, nombre: created.nombre });
  }
  console.log("✓ Categorías creadas");

  // ── 6. Productos ──
  const productosData = [
    { nombre: "Laptop Pro X1", tipo: "electrónico", descripcion: "Laptop de alto rendimiento con 16GB RAM y 512GB SSD", precioBase: 1200, emailProveedor: "proveedor@techcorp.com", categoriaId: categorias[0].id },
    { nombre: "Mouse Ergonómico", tipo: "electrónico", descripcion: "Mouse inalámbrico ergonómico con 6 botones", precioBase: 45, emailProveedor: "ventas@techworld.com", categoriaId: categorias[0].id },
    { nombre: "Teclado Mecánico RGB", tipo: "electrónico", descripcion: "Teclado mecánico retroiluminado con switches Cherry MX", precioBase: 89, emailProveedor: "ventas@techworld.com", categoriaId: categorias[0].id },
    { nombre: "Monitor 4K 27\"", tipo: "electrónico", descripcion: "Monitor IPS 4K UHD de 27 pulgadas", precioBase: 450, emailProveedor: "distribucion@displayplus.com", categoriaId: categorias[0].id },
    { nombre: "Webcam HD Pro", tipo: "electrónico", descripcion: "Cámara web 1080p con micrófono integrado", precioBase: 65, emailProveedor: "ventas@techworld.com", categoriaId: categorias[0].id },
    { nombre: "Auriculares Bluetooth", tipo: "electrónico", descripcion: "Auriculares inalámbricos con cancelación de ruido", precioBase: 120, emailProveedor: "info@audiogear.com", categoriaId: categorias[0].id },
    { nombre: "Cargador USB-C 65W", tipo: "electrónico", descripcion: "Cargador rápido USB-C Power Delivery", precioBase: 35, emailProveedor: "proveedor@techcorp.com", categoriaId: categorias[0].id },
    { nombre: "Cable HDMI 2m", tipo: "electrónico", descripcion: "Cable HDMI 2.0 de 2 metros", precioBase: 12, emailProveedor: "proveedor@techcorp.com", categoriaId: categorias[0].id },
    { nombre: "Sofá 3 Cuerpos", tipo: "mueble", descripcion: "Sofá tapizado en tela premium, color gris", precioBase: 850, emailProveedor: "muebles@hogarplus.com", categoriaId: categorias[1].id },
    { nombre: "Mesa de Centro", tipo: "mueble", descripcion: "Mesa de centro de madera maciza con acabado natural", precioBase: 320, emailProveedor: "muebles@hogarplus.com", categoriaId: categorias[1].id },
    { nombre: "Lámpara LED", tipo: "iluminación", descripcion: "Lámpara de mesa LED regulable con temperatura de color", precioBase: 45, emailProveedor: "iluminacion@luzviva.com", categoriaId: categorias[1].id },
    { nombre: "Set de Sábanas Queen", tipo: "textil", descripcion: "Set de sábanas de algodón egipcio para cama Queen", precioBase: 75, emailProveedor: "textiles@conforttotal.com", categoriaId: categorias[1].id },
    { nombre: "Camisa Casual M/L", tipo: "vestimenta", descripcion: "Camisa de vestir manga larga, corte moderno", precioBase: 35, emailProveedor: "moda@vestirbien.com", categoriaId: categorias[2].id },
    { nombre: "Jeans Clásicos", tipo: "vestimenta", descripcion: "Jeans de corte recto, denim premium", precioBase: 55, emailProveedor: "moda@vestirbien.com", categoriaId: categorias[2].id },
    { nombre: "Zapatos Deportivos", tipo: "calzado", descripcion: "Zapatos deportivos ligeros con suela amortiguada", precioBase: 80, emailProveedor: "deportes@activewear.com", categoriaId: categorias[2].id },
    { nombre: "Chaqueta Impermeable", tipo: "vestimenta", descripcion: "Chaqueta con membrana impermeable y transpirable", precioBase: 120, emailProveedor: "moda@vestirbien.com", categoriaId: categorias[2].id },
    { nombre: "Arroz 1kg", tipo: "alimento", descripcion: "Arroz blanco de primera calidad, presentación 1kg", precioBase: 2.5, emailProveedor: "alimentos@distribuidora.com", categoriaId: categorias[3].id },
    { nombre: "Aceite Vegetal 1L", tipo: "alimento", descripcion: "Aceite vegetal 100% maíz, 1 litro", precioBase: 4, emailProveedor: "alimentos@distribuidora.com", categoriaId: categorias[3].id },
    { nombre: "Café Premium 250g", tipo: "alimento", descripcion: "Café tostado molido 100% arábica", precioBase: 8, emailProveedor: "cafe@aromatico.com", categoriaId: categorias[3].id },
    { nombre: "Agua Mineral 1.5L", tipo: "bebida", descripcion: "Agua mineral natural, botella 1.5 litros", precioBase: 1.5, emailProveedor: "bebidas@hidratar.com", categoriaId: categorias[3].id },
    { nombre: "Multivitamínico 60 tabs", tipo: "salud", descripcion: "Suplemento multivitamínico completo, 60 tabletas", precioBase: 22, emailProveedor: "salud@bienestartotal.com", categoriaId: categorias[4].id },
    { nombre: "Protector Solar SPF50", tipo: "salud", descripcion: "Protector solar de amplio espectro, resistente al agua", precioBase: 15, emailProveedor: "salud@bienestartotal.com", categoriaId: categorias[4].id },
    { nombre: "Shampoo Reparador 400ml", tipo: "salud", descripcion: "Shampoo con keratina para cabello dañado", precioBase: 9, emailProveedor: "cuidado@glowlab.com", categoriaId: categorias[4].id },
    { nombre: "Pelota de Fútbol", tipo: "deporte", descripcion: "Balón de fútbol oficial, tamaño 5, cuero sintético", precioBase: 30, emailProveedor: "deportes@activewear.com", categoriaId: categorias[5].id },
    { nombre: "Pesa 10kg", tipo: "deporte", descripcion: "Pesa rusa de hierro fundido, 10 kilogramos", precioBase: 40, emailProveedor: "deportes@activewear.com", categoriaId: categorias[5].id },
    { nombre: "Bicicleta Montañera", tipo: "deporte", descripcion: "Bicicleta de montaña con 21 velocidades y suspensión", precioBase: 450, emailProveedor: "deportes@activewear.com", categoriaId: categorias[5].id },
  ];
  const productos: { id: number; precioBase: number; nombre: string }[] = [];
  for (const p of productosData) {
    const created = await prisma.producto.create({ data: p });
    productos.push({ id: created.id, precioBase: created.precioBase, nombre: created.nombre });
  }
  console.log(`✓ ${productos.length} productos creados`);

  // ── 7. Inventario (cada sucursal tiene varios productos con distintos estados) ──
  const estadosStock = ["optimo", "bajo", "critico"];
  const statusesInventario = ["disponible", "no disponible"];
  let invCount = 0;
  for (let si = 0; si < sucursales.length; si++) {
    const sucId = sucursales[si].id;
    const productSlice = productos.slice(si * 5, si * 5 + 12);
    for (const prod of productSlice) {
      const stockActual = [20, 15, 8, 3, 0, 25][Math.floor(Math.random() * 6)];
      const stockMinimo = [5, 10, 15][Math.floor(Math.random() * 3)];
      const estadoStockKey = stockActual === 0 ? "critico" : stockActual <= stockMinimo ? "bajo" : "optimo";
      await prisma.inventario.create({
        data: {
          sucursalId: sucId,
          productoId: prod.id,
          stockActual,
          stockMinimo,
          cantVentas: Math.floor(Math.random() * 50),
          estadoStock: estadoStockKey,
          status: stockActual === 0 ? "no disponible" : "disponible",
        },
      });
      invCount++;
    }
  }
  console.log(`✓ ${invCount} inventarios creados`);

  // ── 8. Clientes (15) ──
  const clientes: { id: number; nombre: string; apellido: string }[] = [];
  const apellidos = ["García", "Rodríguez", "Martínez", "López", "Hernández", "González", "Pérez", "Sánchez", "Ramírez", "Torres", "Flores", "Rivera", "Gómez", "Díaz", "Cruz"];
  for (let i = 1; i <= 15; i++) {
    const apellido = apellidos[i - 1];
    const created = await prisma.cliente.upsert({
      where: { correo: `cliente${i}@gmail.com` },
      create: {
        nombre: `Cliente${i}`,
        apellido,
        cedula: `V-2${String(i).padStart(7, "0")}`,
        correo: `cliente${i}@gmail.com`,
        password: "cliente123",
        telefono: `+58-414-${String(1000000 + i).slice(1)}`,
        direccion: `Dir. Cliente ${i}, ${["Caracas", "Maracaibo", "Valencia", "Barquisimeto", "Puerto Ordaz"][i % 5]}`,
        tipoCliente: ["bronce", "plata", "oro"][i % 3],
      },
      update: {},
    });
    clientes.push({ id: created.id, nombre: created.nombre, apellido: created.apellido });
  }
  console.log(`✓ ${clientes.length} clientes creados`);

  // ── 9. Pedidos + Detalles ──
  const statusesPedido = ["pendiente", "preparado", "en_camino", "entregado", "cancelado"];
  let pedidoCount = 0;
  for (let i = 0; i < 40; i++) {
    const cliente = clientes[Math.floor(Math.random() * clientes.length)];
    const sucursal = sucursales[Math.floor(Math.random() * sucursales.length)];
    const status = statusesPedido[Math.floor(Math.random() * statusesPedido.length)];
    const repartidorId = status === "en_camino" || status === "entregado" ? deliveryUser.id : null;
    const daysAgo = Math.floor(Math.random() * 60);
    const fecha = new Date(Date.now() - daysAgo * 86400000 - Math.floor(Math.random() * 86400000));

    const numDetalles = 1 + Math.floor(Math.random() * 4);
    let total = 0;
    const detalles: { productoId: number; cantidad: number; precioUnit: number }[] = [];
    const usedProductIds = new Set<number>();
    for (let d = 0; d < numDetalles; d++) {
      let prod;
      do {
        prod = productos[Math.floor(Math.random() * productos.length)];
      } while (usedProductIds.has(prod.id));
      usedProductIds.add(prod.id);
      const cantidad = 1 + Math.floor(Math.random() * 4);
      const precioUnit = prod.precioBase;
      total += cantidad * precioUnit;
      detalles.push({ productoId: prod.id, cantidad, precioUnit });
    }

    await prisma.pedido.create({
      data: {
        clienteId: cliente.id,
        sucursalId: sucursal.id,
        repartidorId,
        total,
        status,
        fecha,
        detalles: { create: detalles },
      },
    });
    pedidoCount++;
  }
  console.log(`✓ ${pedidoCount} pedidos creados con detalles`);

  // ── 10. Conexiones ──
  const devices = ["Android", "iPhone", "Windows Desktop", "MacBook", "iPad"];
  for (const c of clientes) {
    const numConexiones = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numConexiones; i++) {
      await prisma.conexion.create({
        data: {
          clienteId: c.id,
          ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          latitud: 8 + Math.random() * 4,
          longitud: -72 + Math.random() * 6,
          dispositivo: devices[Math.floor(Math.random() * devices.length)],
          fecha: new Date(Date.now() - Math.floor(Math.random() * 90) * 86400000),
        },
      });
    }
  }
  console.log("✓ Conexiones creadas");

  // ── 11. Competidores ──
  const competidoresData = [
    { nombre: "ElectroMundo C.A.", ciudad: "Caracas", direccion: "CC Sambil, Nivel 2", coordenadasLat: 10.4961, coordenadasLng: -66.8442, cantReviews: 230, ratingPromedio: 4.2, tipoNegocio: "Tienda de Electrónica", categories: '["Electrónica","Hogar"]', placeId: "ChIJ-caracas-1", website: "https://electromundo.com", phone: "+58-212-555-1000" },
    { nombre: "TechShop Venezuela", ciudad: "Caracas", direccion: "Av. Libertador, Edif. Tech", coordenadasLat: 10.4880, coordenadasLng: -66.8730, cantReviews: 150, ratingPromedio: 4.5, tipoNegocio: "Tecnología", categories: '["Electrónica"]', placeId: "ChIJ-caracas-2", website: "https://techshop.co.ve", phone: "+58-212-555-2000" },
    { nombre: "MegaElectro", ciudad: "Maracaibo", direccion: "Calle 72, Centro Comercial Galerías", coordenadasLat: 10.6350, coordenadasLng: -71.6450, cantReviews: 85, ratingPromedio: 3.8, tipoNegocio: "Electrodomésticos", categories: '["Hogar","Electrónica"]', placeId: "ChIJ-maracaibo-1", website: "https://megaelectro.com", phone: "+58-261-555-3000" },
    { nombre: "Deportes Extremos", ciudad: "Valencia", direccion: "CC Metropolitano, Nivel 1", coordenadasLat: 10.1600, coordenadasLng: -68.0000, cantReviews: 120, ratingPromedio: 4.0, tipoNegocio: "Tienda Deportiva", categories: '["Deportes"]', placeId: "ChIJ-valencia-1", website: "https://deportesextremos.com", phone: "+58-241-555-4000" },
    { nombre: "FarmaSalud", ciudad: "Barquisimeto", direccion: "Av. Vargas, CC Obelisco", coordenadasLat: 10.0700, coordenadasLng: -69.3200, cantReviews: 200, ratingPromedio: 4.7, tipoNegocio: "Farmacia", categories: '["Salud"]', placeId: "ChIJ-barquisimeto-1", website: "https://farmaciasalud.com", phone: "+58-251-555-5000" },
    { nombre: "Hogar & Estilo", ciudad: "Caracas", direccion: "CC El Recreo, Nivel 3", coordenadasLat: 10.4920, coordenadasLng: -66.8600, cantReviews: 95, ratingPromedio: 4.1, tipoNegocio: "Decoración", categories: '["Hogar"]', placeId: "ChIJ-caracas-3", website: "https://hogaryestilo.com", phone: "+58-212-555-6000" },
    { nombre: "ModaExpress", ciudad: "Maracaibo", direccion: "CC Lago Mall, Local 15", coordenadasLat: 10.6380, coordenadasLng: -71.6380, cantReviews: 180, ratingPromedio: 3.9, tipoNegocio: "Ropa y Accesorios", categories: '["Ropa"]', placeId: "ChIJ-maracaibo-2", website: "https://modaexpress.com", phone: "+58-261-555-7000" },
    { nombre: "SuperAlimentos", ciudad: "Valencia", direccion: "Av. Bolívar Sur, Local 10", coordenadasLat: 10.1550, coordenadasLng: -68.0050, cantReviews: 310, ratingPromedio: 4.3, tipoNegocio: "Supermercado", categories: '["Alimentos"]', placeId: "ChIJ-valencia-2", website: "https://superalimentos.com", phone: "+58-241-555-8000" },
    { nombre: "VidaActiva", ciudad: "Puerto Ordaz", direccion: "CC Alta Vista, Nivel 1", coordenadasLat: 8.3100, coordenadasLng: -62.7200, cantReviews: 65, ratingPromedio: 4.6, tipoNegocio: "Gimnasio y Deportes", categories: '["Deportes","Salud"]', placeId: "ChIJ-puertoordaz-1", website: "https://vidaactiva.com", phone: "+58-286-555-9000" },
    { nombre: "TecnoWorld", ciudad: "Barquisimeto", direccion: "CC Barquisimeto, Local 8", coordenadasLat: 10.0750, coordenadasLng: -69.3250, cantReviews: 140, ratingPromedio: 4.4, tipoNegocio: "Tecnología", categories: '["Electrónica"]', placeId: "ChIJ-barquisimeto-2", website: "https://tecmundo.com", phone: "+58-251-555-1000" },
  ];
  const competidoresIds: number[] = [];
  for (const c of competidoresData) {
    const created = await prisma.competidor.upsert({
      where: { placeId: c.placeId },
      create: c,
      update: {},
    });
    competidoresIds.push(created.id);
  }
  console.log(`✓ ${competidoresIds.length} competidores creados`);

  // ── 12. BusquedaCompetidor + CompetidoresBusqueda ──
  const busquedasData = [
    { categorias: '["Electrónica"]', ciudades: '["Caracas"]', maxPlaces: 5, competidorIndices: [0, 1, 5] },
    { categorias: '["Deportes"]', ciudades: '["Valencia","Maracaibo"]', maxPlaces: 3, competidorIndices: [3] },
    { categorias: '["Alimentos"]', ciudades: '["Valencia"]', maxPlaces: 5, competidorIndices: [7] },
    { categorias: '["Salud","Hogar"]', ciudades: '["Barquisimeto","Caracas"]', maxPlaces: 5, competidorIndices: [4, 5, 9] },
  ];
  for (const b of busquedasData) {
    const busqueda = await prisma.busquedaCompetidor.create({
      data: { categorias: b.categorias, ciudades: b.ciudades, maxPlaces: b.maxPlaces },
    });
    for (const idx of b.competidorIndices) {
      await prisma.competidoresBusqueda.create({
        data: { busquedaId: busqueda.id, competidorId: competidoresIds[idx] },
      });
    }
  }
  console.log("✓ Búsquedas de competidores creadas");

  // ── 13. Informes Analíticos ──
  const tiposAnalisis = ["ventas", "demanda_geo", "comportamiento"];
  for (let i = 0; i < 6; i++) {
    const sucursal = sucursales[Math.floor(Math.random() * sucursales.length)];
    const tipo = tiposAnalisis[i % 3];
    await prisma.informeAnalitico.create({
      data: {
        tipoAnalisis: tipo,
        sucursalId: sucursal.id,
        rangoInicio: new Date("2025-01-01"),
        rangoFin: new Date("2025-12-31"),
        dataJson: { totalVentas: Math.floor(Math.random() * 50000), promedioTicket: Math.floor(Math.random() * 100 + 20) },
        insightIA: tipo === "ventas" ? "Se observa un incremento del 15% en ventas durante el último trimestre." : tipo === "demanda_geo" ? "Las zonas con mayor demanda se concentran en el área metropolitana." : "Los clientes recurrentes representan el 40% de las transacciones.",
      },
    });
  }
  console.log("✓ Informes analíticos creados");

  // ── 14. GeoIP + Auditoría (algunas entradas) ──
  const geoIPsData = [
    { ip: "190.10.0.1", proveedor: "CANTV", ciudad: "Caracas", pais: "Venezuela", latitud: 10.4806, longitud: -66.9036 },
    { ip: "190.10.0.2", proveedor: "Movistar", ciudad: "Maracaibo", pais: "Venezuela", latitud: 10.6317, longitud: -71.6403 },
    { ip: "190.10.0.3", proveedor: "Digitel", ciudad: "Valencia", pais: "Venezuela", latitud: 10.1621, longitud: -68.0024 },
    { ip: "190.10.0.4", proveedor: "CANTV", ciudad: "Barquisimeto", pais: "Venezuela", latitud: 10.0731, longitud: -69.3227 },
  ];
  for (const g of geoIPsData) {
    await prisma.geoIP.upsert({
      where: { ip: g.ip },
      create: g,
      update: {},
    });
  }
  console.log("✓ GeoIPs creados");

  const rutas = ["/", "/admin", "/api/tienda/productos", "/api/pedidos/mis-pedidos", "/api/productos", "/api/sucursales"];
  const metodos = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  for (let i = 0; i < 20; i++) {
    await prisma.auditoria.create({
      data: {
        ip: `190.10.0.${Math.floor(Math.random() * 5) + 1}`,
        ruta: rutas[Math.floor(Math.random() * rutas.length)],
        metodo: metodos[Math.floor(Math.random() * metodos.length)],
        clienteId: Math.random() > 0.5 && clientes.length ? clientes[Math.floor(Math.random() * clientes.length)].id : null,
        geoIPId: Math.floor(Math.random() * 4) + 1,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000),
      },
    });
  }
  console.log("✓ Auditorías creadas");

  console.log("\n✅ Seed completado exitosamente!");
}

main()
  .catch((e) => {
    console.error("❌ Error durante el seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
