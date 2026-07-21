-- CreateTable
CREATE TABLE "EmpresaConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "nombreEmpresa" TEXT NOT NULL,
    "rif" TEXT NOT NULL,
    "direccionFiscal" TEXT NOT NULL,
    "telefono" TEXT,
    "logoUrl" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Venezuela',
    "colorPrimario" TEXT NOT NULL DEFAULT '#5713be',
    "pagoMovilBanco" TEXT,
    "pagoMovilCedulaTipo" TEXT,
    "pagoMovilCedula" TEXT,
    "pagoMovilTelefono" TEXT,
    "bannerImg" TEXT,
    "bannerTitle" TEXT,
    "bannerSubtitle" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "costoPorKm" REAL NOT NULL DEFAULT 0,
    "precioMinimoEntrega" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "googleId" TEXT,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "tipoCliente" TEXT NOT NULL DEFAULT 'bronce',
    "coordenadasLat" REAL,
    "coordenadasLng" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TipoPersonal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "pagaMensual" REAL NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Personal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "telefono" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'trabajador',
    "status" BOOLEAN NOT NULL DEFAULT true,
    "sucursalId" INTEGER,
    "tipoPersonalId" INTEGER,
    "sueldoMensual" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Personal_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Personal_tipoPersonalId_fkey" FOREIGN KEY ("tipoPersonalId") REFERENCES "TipoPersonal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sucursal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "coordenadasLat" REAL NOT NULL,
    "coordenadasLng" REAL NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'secundaria',
    "status" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Competidor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "direccion" TEXT,
    "coordenadasLat" REAL NOT NULL,
    "coordenadasLng" REAL NOT NULL,
    "cantReviews" INTEGER NOT NULL DEFAULT 0,
    "ratingPromedio" REAL,
    "tipoNegocio" TEXT,
    "categories" TEXT,
    "placeId" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "ultimaVerif" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BusquedaCompetidor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categorias" TEXT NOT NULL,
    "ciudades" TEXT NOT NULL,
    "maxPlaces" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CompetidoresBusqueda" (
    "busquedaId" INTEGER NOT NULL,
    "competidorId" INTEGER NOT NULL,

    PRIMARY KEY ("busquedaId", "competidorId"),
    CONSTRAINT "CompetidoresBusqueda_busquedaId_fkey" FOREIGN KEY ("busquedaId") REFERENCES "BusquedaCompetidor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompetidoresBusqueda_competidorId_fkey" FOREIGN KEY ("competidorId") REFERENCES "Competidor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT,
    "precioBase" REAL NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "costo" REAL,
    "emailProveedor" TEXT NOT NULL,
    "imagen" TEXT,
    "categoriaId" INTEGER NOT NULL,
    CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Inventario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sucursalId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "stockActual" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 5,
    "cantVentas" INTEGER NOT NULL DEFAULT 0,
    "estadoStock" TEXT NOT NULL DEFAULT 'optimo',
    "status" TEXT NOT NULL DEFAULT 'disponible',
    "ultimaReposicion" DATETIME NOT NULL,
    CONSTRAINT "Inventario_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeoIP" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ip" TEXT NOT NULL,
    "proveedor" TEXT,
    "ciudad" TEXT,
    "pais" TEXT,
    "latitud" REAL,
    "longitud" REAL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ip" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "metodo" TEXT NOT NULL,
    "clienteId" INTEGER,
    "personalId" INTEGER,
    "dispositivoId" TEXT,
    "geoIPId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Auditoria_geoIPId_fkey" FOREIGN KEY ("geoIPId") REFERENCES "GeoIP" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Conexion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" INTEGER,
    "dispositivoId" TEXT,
    "ip" TEXT NOT NULL,
    "latitud" REAL NOT NULL,
    "longitud" REAL NOT NULL,
    "dispositivo" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conexion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Compra" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" INTEGER NOT NULL,
    "sucursalId" INTEGER NOT NULL,
    "repartidorId" INTEGER,
    "total" REAL NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'compra_web',
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "metodoPago" TEXT,
    "refPago" TEXT,
    "direccionEntrega" TEXT,
    "coordenadasLat" REAL,
    "coordenadasLng" REAL,
    "distanciaKm" REAL,
    "costoEnvio" REAL,
    "repartidorCoordenadasLat" REAL,
    "repartidorCoordenadasLng" REAL,
    "ultimaActualizacionUbicacion" DATETIME,
    "tasaCambio" REAL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Compra_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Compra_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Compra_repartidorId_fkey" FOREIGN KEY ("repartidorId") REFERENCES "Personal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UbicacionLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "compraId" INTEGER NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UbicacionLog_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompraDetalle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "compraId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnit" REAL NOT NULL,
    "costoUnit" REAL,
    CONSTRAINT "CompraDetalle_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompraDetalle_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GestionEconomica" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "monedaPrincipal" TEXT NOT NULL DEFAULT 'USD',
    "autoUpdate" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "TasaCambio" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "moneda" TEXT NOT NULL,
    "precio" REAL NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Oferta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "montoMinimo" REAL,
    "montoMaximo" REAL,
    "fechaInicio" DATETIME NOT NULL,
    "fechaFin" DATETIME NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoriaId" INTEGER,
    "productoId" INTEGER,
    CONSTRAINT "Oferta_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Oferta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OfertaSucursal" (
    "ofertaId" INTEGER NOT NULL,
    "sucursalId" INTEGER NOT NULL,

    PRIMARY KEY ("ofertaId", "sucursalId"),
    CONSTRAINT "OfertaSucursal_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "Oferta" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OfertaSucursal_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OfertaExcepcion" (
    "ofertaId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,

    PRIMARY KEY ("ofertaId", "productoId"),
    CONSTRAINT "OfertaExcepcion_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "Oferta" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OfertaExcepcion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CiudadPoblacion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "poblacion" INTEGER NOT NULL,
    "latitud" REAL NOT NULL,
    "longitud" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "CoeficienteFestividad" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mes" INTEGER NOT NULL,
    "coeficienteConsumoMasivo" REAL NOT NULL,
    "coeficienteTecnologia" REAL NOT NULL,
    "coeficienteRopa" REAL NOT NULL,
    "coeficienteRestaurantes" REAL NOT NULL,
    "coeficientePromedio" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" INTEGER
);

-- CreateTable
CREATE TABLE "CategoriaSinergia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoriaEmpresa" TEXT NOT NULL,
    "categoriaTractora" TEXT NOT NULL,
    "peso" REAL NOT NULL DEFAULT 1.0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InformeAnalitico" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipoAnalisis" TEXT NOT NULL,
    "sucursalId" INTEGER,
    "rangoInicio" DATETIME NOT NULL,
    "rangoFin" DATETIME NOT NULL,
    "dataJson" JSONB NOT NULL,
    "insightIA" JSONB,
    "cacheKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InformeAnalitico_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "compraId" INTEGER NOT NULL,
    "repartidorId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Chat_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Chat_repartidorId_fkey" FOREIGN KEY ("repartidorId") REFERENCES "Personal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Chat_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mensaje" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chatId" INTEGER NOT NULL,
    "emisorTipo" TEXT NOT NULL,
    "emisorId" INTEGER NOT NULL,
    "contenido" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Mensaje_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EmpresaConfig_rif_key" ON "EmpresaConfig"("rif");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_googleId_key" ON "Cliente"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_cedula_key" ON "Cliente"("cedula");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_correo_key" ON "Cliente"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "TipoPersonal_nombre_key" ON "TipoPersonal"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Personal_cedula_key" ON "Personal"("cedula");

-- CreateIndex
CREATE UNIQUE INDEX "Personal_correo_key" ON "Personal"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "Competidor_placeId_key" ON "Competidor"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "BusquedaCompetidor_categorias_ciudades_maxPlaces_key" ON "BusquedaCompetidor"("categorias", "ciudades", "maxPlaces");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Inventario_sucursalId_productoId_key" ON "Inventario"("sucursalId", "productoId");

-- CreateIndex
CREATE UNIQUE INDEX "GeoIP_ip_key" ON "GeoIP"("ip");

-- CreateIndex
CREATE INDEX "Auditoria_createdAt_idx" ON "Auditoria"("createdAt");

-- CreateIndex
CREATE INDEX "Auditoria_ip_idx" ON "Auditoria"("ip");

-- CreateIndex
CREATE INDEX "Auditoria_ruta_idx" ON "Auditoria"("ruta");

-- CreateIndex
CREATE INDEX "Conexion_clienteId_idx" ON "Conexion"("clienteId");

-- CreateIndex
CREATE INDEX "Conexion_fecha_idx" ON "Conexion"("fecha");

-- CreateIndex
CREATE INDEX "Compra_fecha_idx" ON "Compra"("fecha");

-- CreateIndex
CREATE INDEX "Compra_sucursalId_idx" ON "Compra"("sucursalId");

-- CreateIndex
CREATE INDEX "Compra_clienteId_idx" ON "Compra"("clienteId");

-- CreateIndex
CREATE INDEX "Compra_status_idx" ON "Compra"("status");

-- CreateIndex
CREATE INDEX "Compra_repartidorId_idx" ON "Compra"("repartidorId");

-- CreateIndex
CREATE INDEX "UbicacionLog_compraId_idx" ON "UbicacionLog"("compraId");

-- CreateIndex
CREATE INDEX "UbicacionLog_createdAt_idx" ON "UbicacionLog"("createdAt");

-- CreateIndex
CREATE INDEX "CiudadPoblacion_nombre_idx" ON "CiudadPoblacion"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "CiudadPoblacion_nombre_region_key" ON "CiudadPoblacion"("nombre", "region");

-- CreateIndex
CREATE UNIQUE INDEX "CoeficienteFestividad_mes_key" ON "CoeficienteFestividad"("mes");

-- CreateIndex
CREATE INDEX "CategoriaSinergia_categoriaEmpresa_idx" ON "CategoriaSinergia"("categoriaEmpresa");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaSinergia_categoriaEmpresa_categoriaTractora_key" ON "CategoriaSinergia"("categoriaEmpresa", "categoriaTractora");

-- CreateIndex
CREATE INDEX "InformeAnalitico_createdAt_idx" ON "InformeAnalitico"("createdAt");

-- CreateIndex
CREATE INDEX "InformeAnalitico_tipoAnalisis_idx" ON "InformeAnalitico"("tipoAnalisis");

-- CreateIndex
CREATE INDEX "InformeAnalitico_sucursalId_idx" ON "InformeAnalitico"("sucursalId");

-- CreateIndex
CREATE INDEX "InformeAnalitico_cacheKey_idx" ON "InformeAnalitico"("cacheKey");

-- CreateIndex
CREATE UNIQUE INDEX "Chat_compraId_key" ON "Chat"("compraId");

-- CreateIndex
CREATE INDEX "Chat_compraId_idx" ON "Chat"("compraId");

-- CreateIndex
CREATE INDEX "Chat_repartidorId_idx" ON "Chat"("repartidorId");

-- CreateIndex
CREATE INDEX "Chat_clienteId_idx" ON "Chat"("clienteId");

-- CreateIndex
CREATE INDEX "Mensaje_chatId_idx" ON "Mensaje"("chatId");

-- CreateIndex
CREATE INDEX "Mensaje_createdAt_idx" ON "Mensaje"("createdAt");
