# 🌍 Globy Backend - Engine de Inteligencia de Negocios

Globy es el núcleo de procesamiento y análisis de una plataforma de expansión comercial inteligente. Este repositorio contiene la lógica de servidor, la gestión de base de datos relacional y el motor de integración con modelos de lenguaje (LLM) para transformar datos demográficos y de consumo en decisiones estratégicas de negocio.

## 🛠️ Stack Tecnológico
*   **Runtime**: Node.js (v18+)
*   **Framework**: Express.js (v5+)
*   **ORM**: Prisma
*   **Base de Datos**: PostgreSQL / SQLite (Desarrollo)
*   **Lenguaje**: TypeScript
*   **IA**: Integración de Agentes para procesamiento de reportes analíticos.
*   **Notificaciones**: Servicio SMTP vía Nodemailer para automatización de suministros.

## 🏗️ Arquitectura de Datos
El backend de Globy está estructurado bajo un modelo relacional robusto que permite el escalado de datos en tres vertientes:

1. **Gestión de Inventario Multi-Sucursal**: Implementa una lógica donde la entidad Producto es independiente de las existencias físicas. La tabla Inventario actúa como puente, permitiendo que cada Sucursal gestione su propio catálogo, stock actual y umbrales mínimos de reposición de forma autónoma.
2. **Sensor de Geolocalización (Data Harvesting)**: El sistema expone endpoints diseñados para capturar la huella geográfica de los clientes (IP, Latitud, Longitud). Esta data se almacena en la tabla de Conexiones, proporcionando el insumo necesario para que el módulo de IA identifique clusters de demanda en zonas donde la empresa aún no tiene presencia física.
3. **Engine de Análisis e IA**: Utiliza una tabla de InformesAnaliticos para la persistencia de resultados. El backend procesa los datos crudos de ventas, competencia y conexiones, y los entrega a un agente de IA que devuelve Data Estructurada (JSONB) e Insights Narrativos.

---

## 📂 Estructura de Directorios
```text
backend/
├── prisma/                  # Configuración de base de datos y migraciones
│   ├── schema.prisma        # Definición del modelo de datos
│   └── migrations/          # Historial de cambios en la base de datos
├── src/                     # Código fuente del servidor
│   ├── config/              # Configuraciones globales (Prisma, Cloudinary, etc.)
│   ├── controllers/         # Lógica de negocio y manejo de peticiones
│   ├── generated/           # Cliente de Prisma generado (Tipos e interfaces)
│   ├── routes/              # Definición de rutas de la API
│   ├── types/               # Interfaces y tipos personalizados de TypeScript
│   └── app.ts               # Punto de entrada de la aplicación
├── .env                     # Variables de entorno (Sensible)
├── package.json             # Dependencias y scripts
└── tsconfig.json            # Configuración de TypeScript
```

---

## ⚙️ Documentación de Controladores

Todos los controladores esperan datos en el cuerpo de la petición (`req.body`) y devuelven respuestas en formato JSON.

### 👥 Clientes (`ClienteControllers.ts`)
*   **`ClienteRegister`**: 
    *   `nombre`, `apellido`, `cedula`, `correo`, `password`, `direccion` (opcional).
*   **`ClienteLogin`**: 
    *   `correo`, `password`.
*   **`UpdateCliente`**: 
    *   `id` (requerido), `nombre`, `apellido`, `correo`, etc. (campos opcionales a editar).

### 👨‍💼 Personal (`PersonalControllers.ts`)
*   **`PersonalRegister`**: 
    *   `nombre`, `apellido`, `correo`, `password`, `rol`, `sucursalId`.
*   **`PersonalLogin`**: 
    *   `correo`, `password`. Devuelve los datos del empleado y su sucursal asociada.

### 📦 Productos (`ProductoControllers.ts`)
*   **`CreateProducto`**: 
    *   `nombre`, `tipo`, `descripcion`, `precioBase`, `emailProveedor`.
*   **`UpdateProducto`**: 
    *   `id` (requerido) y campos a modificar.

### 🏢 Sucursales (`SucursalControllers.ts`)
*   **`CreateSucursal`**: 
    *   `nombre`, `ciudad`, `direccion`, `coordenadasLat`, `coordenadasLng`.
*   **`GetAllSucursales`**: 
    *   No requiere parámetros. Devuelve todas las sedes con un conteo de su personal y productos.

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
3.  **Variables de Entorno**: Configura tu archivo `.env` con la `DATABASE_URL`.
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
