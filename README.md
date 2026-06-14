# 🌍 Globy Backend - Motor Analítico de Expansión Comercial

**Globy** es el backend de una plataforma de gestión comercial inteligente diseñada para ayudar a redes de tiendas a capturar, analizar y automatizar decisiones estratégicas. Combina inventario multi-sucursal, gestión de pedidos, auditoría de acceso y geolocalización con capacidades de análisis y generación de informes para que la empresa pueda tomar acciones basadas en datos.

## ¿Qué es Globy?
Globy es un sistema pensado para negocios que necesitan controlar su operación desde varias sedes físicas, gestionar productos y pedidos, y enriquecer información de mercado con datos de competencia y geolocalización. El backend centraliza:
* Clientes, personal y sucursales
* Productos, inventario y categorías
* Pedidos y detalles de venta
* Registro de actividad y ubicación de clientes
* Búsqueda de competidores y métricas de mercado
* Generación de informes analíticos con IA

## 🛠️ Stack Tecnológico
* **Runtime**: Node.js (v18+)
* **Framework**: Express.js (v5+)
* **ORM**: Prisma (v7)
* **Base de Datos**: SQLite (desarrollo local, `DATABASE_URL=file:./prisma/dev.db`)
* **Lenguaje**: TypeScript
* **IA**: OpenAI / agentes de análisis para generación de insights
* **Notificaciones**: Nodemailer + SMTP
* **Carga de archivos**: Multer

## 🏗️ Modelo de Datos Actual
Globy utiliza un modelo relacional con las siguientes capacidades clave:
1. **Inventario multi-sucursal**: cada `Producto` puede existir en múltiples `Sucursal` a través de `Inventario`, lo que permite controlar stock, ventas y estado por ubicación.
2. **Auditoría y geolocalización**: las tablas `Auditoria`, `GeoIP` y `Conexion` registran accesos, IP y coordenadas, para analizar el comportamiento geográfico de clientes y tráfico.
3. **Análisis de mercado**: `InformeAnalitico` guarda resultados de análisis de ventas, demanda por zona y competidores, almacenando datos estructurados en JSON junto a insights generados por IA.
4. **Gestión económica**: `GestionEconomica` centraliza la lógica de tasas, actualización de precios y datos de BCV.

## 🌐 API y Módulos Principales
El servidor expone los siguientes módulos principales:
* `/clientes` — gestión de clientes, registro, login, consulta y actualización
* `/personal` — gestión de empleados, login, estado y asignación a sucursales
* `/productos` — catálogo, detalles, inventario por sucursal, actualización de stock e imágenes
* `/sucursales` — creación, listados, consulta y control de habilitación
* `/categorias` — clasificación de productos
* `/pedidos` — creación de pedidos, estado, asignación, detalles y pedidos por cliente
* `/competitors` — búsqueda de competidores y consultas históricas
* `/gestion-economica` — configuración de moneda, tasa y ajustes económicos
* `/bcv` — sincronización y verificación de precio del BCV
* `/tienda` — endpoints públicos para tienda: productos, categorías y detalle de producto
* `/config` — configuración global de empresa y logo

## 📌 Endpoints Relevantes
### Clientes
* `POST /clientes/register`
* `POST /clientes/login`
* `GET /clientes/search/:cedula`
* `POST /clientes/data`
* `PUT /clientes/update`
* `GET /clientes/all`

### Personal
* `POST /personal/register`
* `POST /personal/login`
* `GET /personal/all`
* `PUT /personal/update`
* `POST /personal/data`
* `GET /personal/:id`
* `PATCH /personal/:id/enable`
* `PATCH /personal/:id/disable`

### Productos
* `POST /productos/upload-image`
* `POST /productos/create`
* `GET /productos/all`
* `GET /productos/detail/:id`
* `POST /productos/data`
* `PUT /productos/update`
* `PATCH /productos/:id/enable`
* `PATCH /productos/:id/disable`
* `GET /productos/inventory/:sucursalId`
* `GET /productos/categorias`
* `POST /productos/inventory/update`

### Pedidos
* `POST /pedidos/create`
* `GET /pedidos/available`
* `GET /pedidos/mine`
* `GET /pedidos/mis-pedidos`
* `GET /pedidos/cliente/:clienteId`
* `POST /pedidos/:id/assign`
* `PUT /pedidos/:id/status`
* `GET /pedidos/:id`
* `GET /pedidos/:pedidoId/detalles`
* `POST /pedidos/:pedidoId/detalles`

### Tienda pública
* `GET /tienda/productos`
* `GET /tienda/categorias`
* `GET /tienda/producto/:id`

## 🚀 Instalación y Arranque
1. Clonar el repositorio:
```bash
git clone https://github.com/tu-usuario/globy-backend.git
```
2. Instalar dependencias:
```bash
npm install
```
3. Configurar variables de entorno en `.env`:
```env
DATABASE_URL="file:./prisma/dev.db"
```
4. Generar Prisma Client:
```bash
npx prisma generate
```
5. Ejecutar migraciones:
```bash
npx prisma migrate dev --name init
```
6. Iniciar el servidor en modo desarrollo:
```bash
npm run dev
```

## 🧭 Estado Actual del Proyecto
Globy está en desarrollo activo. Actualmente cubre:
* Registro y autenticación de clientes y personal
* Gestión de productos, categorías e inventario
* Administración de sucursales y pedidos
* Auditoría de accesos y geolocalización
* Integración de búsquedas de competidores y tienda pública
* Soporte a análisis económico y BCV

**Nota**: La base de datos actual usa SQLite en desarrollo, con `DATABASE_URL` apuntando a `prisma/dev.db`.
