# 🌍 Globy Backend - Engine de Inteligencia de Negocios

Globy es el núcleo de procesamiento y análisis de una plataforma de expansión comercial inteligente. Este repositorio contiene la lógica de servidor, la gestión de base de datos relacional y el motor de integración con modelos de lenguaje (LLM) para transformar datos demográficos y de consumo en decisiones estratégicas de negocio.

## 🛠️ Stack Tecnológico
*   **Runtime**: Node.js (v18+)
*   **Framework**: Express.js (v5+)
*   **ORM**: Prisma
*   **Base de Datos**: PostgreSQL (Producción) / SQLite (Desarrollo local)
*   **Lenguaje**: TypeScript
*   **IA**: Integración de Agentes para procesamiento de reportes analíticos.
*   **Notificaciones**: Servicio SMTP vía Nodemailer para automatización de suministros.

## 🏗️ Arquitectura de Datos
El backend de Globy está estructurado bajo un modelo relacional robusto que permite el escalado de datos en tres vertientes:

1. **Gestión de Inventario Multi-Sucursal**: Implementa una lógica donde la entidad Producto es independiente de las existencias físicas. La tabla Inventario actúa como puente, permitiendo que cada Sucursal gestione su propio catálogo, stock actual y umbrales mínimos de reposición de forma autónoma.
2. **Sensor de Geolocalización (Data Harvesting)**: El sistema expone endpoints diseñados para capturar la huella geográfica de los clientes (IP, Latitud, Longitud). Esta data se almacena en la tabla de Conexiones, proporcionando el insumo necesario para que el módulo de IA identifique clusters de demanda en zonas donde la empresa aún no tiene presencia física.
3. **Engine de Análisis e IA**: Utiliza una tabla de InformesAnaliticos para la persistencia de resultados. El backend procesa los datos crudos de ventas, competencia y conexiones, y los entrega a un agente de IA que devuelve Data Estructurada (JSONB) e Insights Narrativos.

---

## 🛣️ Estructura de Rutas (API)
La API está organizada en módulos. Todas las rutas cuelgan del prefijo definido en el servidor principal:

*   **Clientes**: `/clientes` (Gestión de usuarios finales)
*   **Personal**: `/personal` (Gestión de empleados y administración)
*   **Productos**: `/productos` (Catálogo global de artículos)
*   **Sucursales**: `/sucursales` (Gestión de sedes físicas)

---

## ⚙️ Documentación de Controladores

Todos los controladores esperan datos en el cuerpo de la petición (`req.body`) y devuelven respuestas en formato JSON.

### 👥 Clientes (`ClienteCOntrollers.ts`)
*   `POST /clientes/register`: Registro de nuevos clientes.
*   `POST /clientes/login`: Autenticación de cliente.
*   `POST /clientes/data`: Obtiene datos de un cliente específico (requiere `id`).
*   `PUT /clientes/update`: Actualiza campos del cliente (requiere `id` y datos a modificar).

### 👨‍💼 Personal (`PersonalControllers.ts`)
*   `POST /personal/register`: Registro de personal asociado a una `sucursalId`.
*   `POST /personal/login`: Login de empleado. Devuelve datos del usuario y su sucursal.
*   `POST /personal/data`: Obtiene detalle por ID.
*   `PUT /personal/update`: Actualiza perfil o configuración de empleado.

### 📦 Productos (`Producto.ts`)
*   `POST /productos/create`: Añade un producto al catálogo.
*   `GET /productos/all`: Lista completa de productos disponibles.
*   `POST /productos/data`: Consulta detalle de un producto (requiere `id`).
*   `PUT /productos/update`: Edita información o precios.

### 🏢 Sucursales (`SucursalControllers.ts`)
*   `POST /sucursales/create`: Registra una nueva sede física.
*   `GET /sucursales/all`: Lista todas las sedes con conteo de personal y productos.
*   `POST /sucursales/data`: Detalle de sede (incluye lista de personal asignado).
*   `PUT /sucursales/update`: Edita ubicación o configuración de sucursal.

---

## 🚀 Instalación y Desarrollo

1.  **Clonar el repositorio**:
    ```bash
    git clone https://github.com/tu-usuario/globy-backend.git
    ```
2.  **Instalar dependencias**:
    ```bash
    npm install
    ```
3.  **Variables de Entorno**: Configura tu archivo `.env` con la `DATABASE_URL`. (Por defecto usa SQLite para desarrollo).
4.  **Generar Cliente Prisma**:
    ```bash
    npx prisma generate
    ```
5.  **Despliegue de Base de Datos**:
    ```bash
    npx prisma migrate dev --name init
    ```
6.  **Iniciar Servidor**:
    ```bash
    npm run dev
    ```

---
**Estatus del Proyecto**: En desarrollo activo - Módulo de Inventario y Sucursales (Fase 1).  
**Institución**: UNERG - Ingeniería en Informática.
