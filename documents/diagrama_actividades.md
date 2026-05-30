# 📊 Diagramas de Actividades — Sistema Globy

## Actor: Administrador (admin)

El Administrador tiene acceso completo a todos los módulos del sistema.

---

### DA-ADM-01: Iniciar Sesión

```mermaid
flowchart TD
    A([Inicio]) --> B[Ingresa correo y contraseña]
    B --> C["Frontend envía POST /personal/login"]
    C --> D{¿Existe usuario en DB?}
    D -- No --> E[Retorna 401: Credenciales inválidas]
    E --> F([Fin])
    D -- Sí --> G{¿Contraseña coincide?}
    G -- No --> E
    G -- Sí --> H{¿status = true?}
    H -- No --> I[Frontend: Cuenta inhabilitada]
    I --> F
    H -- Sí --> J["Genera JWT con id, rol,<br/>correo, sucursalId (24h)"]
    J --> K[Retorna userData + token]
    K --> L["Guarda en sessionStorage:<br/>globy_user + globy_token"]
    L --> M["ProtectedRoute verifica rol"]
    M --> N[Renderiza Dashboard]
    N --> F
```

---

### DA-ADM-02: Registrar Personal

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin accede a /usuarios]
    B --> C["Abre formulario de registro"]
    C --> D["Completa: nombre, apellido,<br/>cédula, correo, password,<br/>rol, sucursalId"]
    D --> E["Frontend envía POST<br/>/personal/register"]
    E --> F{Middleware: ¿Token válido?}
    F -- No --> G[401: Acceso denegado]
    G --> H([Fin])
    F -- Sí --> I["Service: prisma.personal.create"]
    I --> J{¿Cédula o correo<br/>ya existen?}
    J -- Sí --> K[500: Error de unicidad]
    K --> H
    J -- No --> L["Crea registro con<br/>status=true, rol asignado"]
    L --> M[Retorna datos sin password]
    M --> N[Frontend actualiza lista]
    N --> H
```

---

### DA-ADM-03: Listar Personal

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin accede a /usuarios]
    B --> C["Frontend envía GET<br/>/personal/all"]
    C --> D{Middleware: ¿Token válido?}
    D -- No --> E[401: Acceso denegado]
    E --> F([Fin])
    D -- Sí --> G["Service: prisma.personal.findMany<br/>include: sucursal<br/>orderBy: createdAt desc"]
    G --> H[Elimina campo password<br/>de cada registro]
    H --> I[Retorna array de personal]
    I --> J["Frontend renderiza tabla<br/>con nombre, rol, sucursal, status"]
    J --> F
```

---

### DA-ADM-04: Editar Personal

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin selecciona un<br/>empleado de la lista]
    B --> C["Modifica campos:<br/>rol, status, sucursalId, etc."]
    C --> D["Frontend envía PUT<br/>/personal/update con id + datos"]
    D --> E{Middleware: ¿Token válido?}
    E -- No --> F[401: Acceso denegado]
    F --> G([Fin])
    E -- Sí --> H{¿Se proporcionó ID?}
    H -- No --> I[400: ID requerido]
    I --> G
    H -- Sí --> J["Service: prisma.personal.update<br/>where: id, data: updateData"]
    J --> K[Retorna datos actualizados<br/>sin password]
    K --> L[Frontend muestra confirmación]
    L --> G
```

---

### DA-ADM-05: Crear Sucursal

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin accede al módulo<br/>de Sucursales]
    B --> C[Abre formulario de<br/>nueva sucursal]
    C --> D["Completa: nombre, ciudad,<br/>dirección, coordenadasLat,<br/>coordenadasLng, tipo"]
    D --> E["Frontend envía POST<br/>/sucursales/create"]
    E --> F{Middleware: ¿Token válido?}
    F -- No --> G[401: Acceso denegado]
    G --> H([Fin])
    F -- Sí --> I["Service: prisma.sucursal.create<br/>con status=true por defecto"]
    I --> J[Retorna sucursal creada]
    J --> K[Frontend actualiza lista<br/>de sucursales]
    K --> H
```

---

### DA-ADM-06: Listar Sucursales

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin accede al módulo<br/>de Sucursales]
    B --> C["Frontend envía GET<br/>/sucursales/all"]
    C --> D{Middleware: ¿Token válido?}
    D -- No --> E[401: Acceso denegado]
    E --> F([Fin])
    D -- Sí --> G["Service: prisma.sucursal.findMany<br/>include: _count de<br/>personal e inventarios"]
    G --> H[Retorna array de sucursales<br/>con conteos]
    H --> I["Frontend renderiza lista con<br/>nombre, ciudad, tipo, conteo<br/>de personal y productos"]
    I --> F
```

---

### DA-ADM-07: Editar Sucursal

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin selecciona una<br/>sucursal de la lista]
    B --> C["Modifica campos:<br/>nombre, dirección, ciudad,<br/>coordenadas, tipo, status"]
    C --> D["Frontend envía PUT<br/>/sucursales/update con id + datos"]
    D --> E{Middleware: ¿Token válido?}
    E -- No --> F[401: Acceso denegado]
    F --> G([Fin])
    E -- Sí --> H{¿Se proporcionó ID?}
    H -- No --> I[400: ID requerido]
    I --> G
    H -- Sí --> J["Service: prisma.sucursal.update<br/>where: id, data: updateData"]
    J --> K[Retorna sucursal actualizada]
    K --> L[Frontend muestra confirmación]
    L --> G
```

---

### DA-ADM-08: Ver Detalle de Sucursal

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin selecciona una<br/>sucursal para ver detalle]
    B --> C["Frontend envía POST<br/>/sucursales/data con id"]
    C --> D{Middleware: ¿Token válido?}
    D -- No --> E[401: Acceso denegado]
    E --> F([Fin])
    D -- Sí --> G["Service: prisma.sucursal.findUnique<br/>include: personal con<br/>id, nombre, apellido, rol"]
    G --> H{¿Sucursal encontrada?}
    H -- No --> I[404: Sucursal no encontrada]
    I --> F
    H -- Sí --> J[Retorna datos de sucursal<br/>+ lista de personal asignado]
    J --> K["Frontend renderiza vista<br/>detallada con mapa y<br/>tabla de empleados"]
    K --> F
```

---

### DA-ADM-09: Crear Producto

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin accede a /productos]
    B --> C[Abre formulario de<br/>nuevo producto]
    C --> D["Completa: nombre, tipo,<br/>descripción, precioBase,<br/>emailProveedor, categoriaId"]
    D --> E["Frontend envía POST<br/>/productos/create"]
    E --> F{Middleware: ¿Token válido?}
    F -- No --> G[401: Acceso denegado]
    G --> H([Fin])
    F -- Sí --> I["Service: prisma.producto.create<br/>categoria: connect por id"]
    I --> J[Retorna producto creado]
    J --> K[Frontend actualiza catálogo]
    K --> H
```

---

### DA-ADM-10: Listar Productos

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin accede a /productos]
    B --> C["Frontend envía GET<br/>/productos/all"]
    C --> D{Middleware: ¿Token válido?}
    D -- No --> E[401: Acceso denegado]
    E --> F([Fin])
    D -- Sí --> G["Service: prisma.producto.findMany"]
    G --> H[Retorna array completo<br/>de productos]
    H --> I["Frontend renderiza tabla<br/>con nombre, tipo, precio,<br/>categoría"]
    I --> F
```

---

### DA-ADM-11: Editar Producto

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin selecciona un<br/>producto de la lista]
    B --> C["Modifica campos:<br/>nombre, precio, tipo,<br/>descripción, proveedor"]
    C --> D["Frontend envía PUT<br/>/productos/update con id + datos"]
    D --> E{Middleware: ¿Token válido?}
    E -- No --> F[401: Acceso denegado]
    F --> G([Fin])
    E -- Sí --> H{¿Se proporcionó ID?}
    H -- No --> I[400: ID requerido]
    I --> G
    H -- Sí --> J["Service: prisma.producto.update"]
    J --> K[Retorna producto actualizado]
    K --> L[Frontend muestra confirmación]
    L --> G
```

---

### DA-ADM-12: Consultar Inventario por Sucursal

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin accede a la sección<br/>de inventario]
    B --> C[Selecciona una sucursal]
    C --> D["Frontend envía GET<br/>/productos/inventory/:sucursalId"]
    D --> E{Middleware: ¿Token válido?}
    E -- No --> F[401: Acceso denegado]
    F --> G([Fin])
    E -- Sí --> H{¿Se proporcionó sucursalId?}
    H -- No --> I[400: ID de sucursal requerido]
    I --> G
    H -- Sí --> J["Service: prisma.inventario.findMany<br/>where: sucursalId<br/>include: producto"]
    J --> K[Retorna array de inventario<br/>con datos del producto]
    K --> L["Frontend renderiza tabla:<br/>producto, stockActual,<br/>stockMínimo, última reposición"]
    L --> G
```

---

### DA-ADM-13: Actualizar Stock

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin está en la vista<br/>de inventario de una sucursal]
    B --> C[Selecciona producto e<br/>ingresa nueva cantidad]
    C --> D["Frontend envía POST<br/>/productos/inventory/update<br/>con sucursalId, productoId, stock"]
    D --> E{Middleware: ¿Token válido?}
    E -- No --> F[401: Acceso denegado]
    F --> G([Fin])
    E -- Sí --> H["Service: prisma.inventario.upsert<br/>where: sucursalId + productoId"]
    H --> I{¿Existe registro<br/>para esa combinación?}
    I -- Sí --> J["UPDATE: stockActual = nuevo valor"]
    I -- No --> K["CREATE: nuevo registro<br/>stockActual = valor,<br/>stockMínimo = 5"]
    J --> L[Retorna inventario actualizado]
    K --> L
    L --> M[Frontend actualiza vista]
    M --> G
```

---

### DA-ADM-14: Ver Categorías

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin accede a /productos]
    B --> C["Frontend envía GET<br/>/productos/categorias"]
    C --> D{Middleware: ¿Token válido?}
    D -- No --> E[401: Acceso denegado]
    E --> F([Fin])
    D -- Sí --> G["Service: prisma.categoria.findMany"]
    G --> H[Retorna array de categorías]
    H --> I["Frontend renderiza lista<br/>o selector de categorías"]
    I --> F
```

---

### DA-ADM-15: Configurar Datos de la Empresa

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin accede a /configuracion]
    B --> C["Frontend envía GET /config/data"]
    C --> D{¿Existe configuración?}
    D -- No --> E[404: No encontrada,<br/>muestra formulario vacío]
    D -- Sí --> F[Carga datos actuales<br/>en el formulario]
    E --> G["Admin completa/modifica:<br/>nombreEmpresa, rif,<br/>direcciónFiscal, teléfono,<br/>moneda, SMTP"]
    F --> G
    G --> H{¿Es primera vez?}
    H -- Sí --> I["Frontend envía POST<br/>/config/create"]
    H -- No --> J["Frontend envía PUT<br/>/config/update"]
    I --> K["Service: prisma.empresaConfig.create"]
    J --> L["Service: prisma.empresaConfig.upsert<br/>where: id=1"]
    K --> M[Retorna configuración guardada]
    L --> M
    M --> N[Frontend muestra confirmación]
    N --> O([Fin])
```

---

### DA-ADM-16: Subir Logo de la Empresa

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin accede a /configuracion]
    B --> C[Selecciona archivo de imagen]
    C --> D{¿Formato válido?<br/>jpg, png, webp}
    D -- No --> E[Error: Solo se permiten<br/>imágenes jpg, png, webp]
    E --> F([Fin])
    D -- Sí --> G{¿Tamaño menor a 5MB?}
    G -- No --> H[Error: Archivo muy grande]
    H --> F
    G -- Sí --> I["Frontend envía POST<br/>/config/upload-logo<br/>Content-Type: multipart/form-data"]
    I --> J{Middleware: ¿Token válido?}
    J -- No --> K[401: Acceso denegado]
    K --> F
    J -- Sí --> L["Multer procesa el archivo:<br/>genera nombre único con<br/>timestamp + extensión"]
    L --> M["Guarda en carpeta /uploads/"]
    M --> N["Retorna URL pública:<br/>protocol://host/uploads/filename"]
    N --> O[Frontend muestra preview<br/>del nuevo logo]
    O --> F
```

---

### DA-ADM-17: Generar Reporte de Patrones de Ventas

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin accede a /globy]
    B --> C["Clic en 'Obtener Patrones<br/>de Ventas' → Generar PDF"]
    C --> D["Frontend envía solicitud<br/>tipo=patrones + rango de fechas"]
    D --> E{Middleware: ¿Token válido<br/>y rol admin/gerente?}
    E -- No --> F[403: No autorizado]
    F --> G([Fin])
    E -- Sí --> H["Backend consulta:<br/>Pedido + PedidoDetalle + Producto"]
    H --> I["Preprocesa datos:<br/>tendencias, productos top,<br/>promedios por período"]
    I --> J[Envía JSON estructurado<br/>al agente de IA]
    J --> K["IA retorna:<br/>1. dataJson con análisis<br/>2. insightIA narrativo"]
    K --> L["Persiste en InformeAnalitico:<br/>tipoAnalisis=ventas,<br/>rangoInicio, rangoFin"]
    L --> M[Genera PDF con<br/>gráficos + insights]
    M --> N[Retorna PDF al frontend]
    N --> O[Frontend habilita descarga]
    O --> G
```

---

### DA-ADM-18: Generar Reporte de Zonas de Demanda

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin accede a /globy]
    B --> C["Clic en 'Obtener Zonas de<br/>Posible Demanda' → Generar PDF"]
    C --> D["Frontend envía solicitud<br/>tipo=demanda + rango"]
    D --> E{Middleware: ¿Token válido<br/>y rol admin/gerente?}
    E -- No --> F[403: No autorizado]
    F --> G([Fin])
    E -- Sí --> H["Backend consulta:<br/>Conexion + Cliente + Competidor"]
    H --> I["Preprocesa datos:<br/>clusters geográficos,<br/>densidad por zona,<br/>competencia cercana"]
    I --> J[Envía JSON al agente de IA]
    J --> K["IA identifica:<br/>zonas sin cobertura,<br/>oportunidades de expansión"]
    K --> L["Persiste en InformeAnalitico:<br/>tipoAnalisis=demanda_geo"]
    L --> M[Genera PDF con<br/>mapas + recomendaciones]
    M --> N[Retorna PDF al frontend]
    N --> G
```

---

### DA-ADM-19: Generar Reporte de Comportamiento

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin accede a /globy]
    B --> C["Clic en 'Obtener Reporte de<br/>Comportamiento' → Generar PDF"]
    C --> D["Frontend envía solicitud<br/>tipo=comportamiento"]
    D --> E{Middleware: ¿Token válido<br/>y rol admin/gerente?}
    E -- No --> F[403: No autorizado]
    F --> G([Fin])
    E -- Sí --> H["Backend consulta:<br/>Cliente + Pedido + Conexion"]
    H --> I["Preprocesa datos:<br/>frecuencia de compra,<br/>ticket promedio,<br/>horarios de conexión,<br/>tipoCliente"]
    I --> J[Envía JSON al agente de IA]
    J --> K["IA genera segmentación:<br/>clientes frecuentes vs<br/>ocasionales, patrones<br/>de navegación"]
    K --> L["Persiste en InformeAnalitico:<br/>tipoAnalisis=comportamiento"]
    L --> M[Genera PDF con insights]
    M --> N[Retorna PDF al frontend]
    N --> G
```

---

### DA-ADM-20: Ver Mapa de Calor (Hot Spots)

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin accede a /globy]
    B --> C["Clic en 'Ver Hot Spots'<br/>→ Ver Mapa"]
    C --> D[Frontend solicita datos<br/>geográficos al backend]
    D --> E["Backend consulta Conexion:<br/>latitud, longitud, clienteId"]
    E --> F["Backend consulta Competidor:<br/>coordenadas, ratings"]
    F --> G["Backend consulta Sucursal:<br/>coordenadas de sedes propias"]
    G --> H["Agrupa datos por zona<br/>y calcula intensidades<br/>de densidad"]
    H --> I["Retorna JSON:<br/>zonasCalor, puntosClientes,<br/>sucursales, competidores"]
    I --> J[Frontend abre Dialog<br/>con mapa SVG/Leaflet]
    J --> K["Renderiza capas:<br/>• Zonas de calor (rojo)<br/>• Puntos de clientes (azul)<br/>• Leyenda de intensidades"]
    K --> L["Muestra contadores:<br/>clientes registrados,<br/>zonas activas"]
    L --> M([Fin])
```

---

### DA-ADM-21: Descargar Reporte PDF Generado

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin accede a /globy]
    B --> C["Ve la sección<br/>'Reportes Generados'"]
    C --> D["Frontend lista reportes:<br/>nombre, tipo, fecha, tamaño"]
    D --> E[Admin selecciona un reporte]
    E --> F["Clic en botón de descarga"]
    F --> G["Frontend solicita archivo<br/>al backend por ID"]
    G --> H{¿Reporte existe?}
    H -- No --> I[404: Reporte no encontrado]
    I --> J([Fin])
    H -- Sí --> K[Backend retorna archivo PDF]
    K --> L[Navegador descarga el PDF]
    L --> J
```

---

### DA-ADM-22: Ver Dashboard General

```mermaid
flowchart TD
    A([Inicio]) --> B["Admin accede a / (Dashboard)"]
    B --> C["Frontend solicita datos<br/>consolidados al backend"]
    C --> D["Backend consulta en paralelo:<br/>• Total ventas del mes<br/>• Conteo productos activos<br/>• Pedidos del día<br/>• Clientes nuevos"]
    D --> E["Backend consulta ventas<br/>mensuales para gráfico<br/>de tendencia"]
    E --> F["Backend consulta top 5<br/>productos más vendidos"]
    F --> G["Backend consulta distribución<br/>de clientes por ciudad"]
    G --> H["Backend consulta productos<br/>con stock bajo<br/>(stockActual menor stockMínimo)"]
    H --> I["Backend consulta<br/>ventas recientes"]
    I --> J["Retorna JSON consolidado<br/>al frontend"]
    J --> K["Frontend renderiza:<br/>• 4 tarjetas de resumen<br/>• Gráfico de tendencia<br/>• Pie chart ciudades<br/>• Top productos<br/>• Alertas stock bajo<br/>• Ventas recientes"]
    K --> L([Fin])
```

---

### DA-ADM-23: Ver Estadísticas Detalladas

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin accede a /estadisticas]
    B --> C["Frontend solicita datos<br/>estadísticos al backend"]
    C --> D["Backend procesa datos por<br/>4 dimensiones"]
    D --> E["Tab Ventas:<br/>• Tendencia mensual<br/>• Ventas por tamaño<br/>• Producto más vendido<br/>por categoría"]
    D --> F["Tab Productos:<br/>• Top 5 más vendidos<br/>• Gráfico de barras<br/>con ingresos por producto"]
    D --> G["Tab Clientes:<br/>• Top clientes por compras<br/>• Clientes nuevos por mes<br/>• Gráfico de líneas"]
    D --> H["Tab Ciudades:<br/>• Distribución por ciudad<br/>• Ventas por zona<br/>• Tabla resumen"]
    E --> I["Retorna JSON con<br/>todos los datasets"]
    F --> I
    G --> I
    H --> I
    I --> J["Frontend renderiza con<br/>Recharts: AreaChart, BarChart,<br/>PieChart, LineChart, Table"]
    J --> K["Admin navega entre tabs<br/>para explorar datos"]
    K --> L([Fin])
```

---

### DA-ADM-24: Ver Lista de Clientes

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin accede a /clientes]
    B --> C["Frontend solicita lista<br/>de clientes al backend"]
    C --> D{Middleware: ¿Token válido?}
    D -- No --> E[401: Acceso denegado]
    E --> F([Fin])
    D -- Sí --> G["Backend consulta todos<br/>los clientes registrados"]
    G --> H["Retorna datos sin password:<br/>nombre, apellido, cédula,<br/>correo, dirección, tipoCliente"]
    H --> I["Frontend renderiza tabla<br/>con filtros y búsqueda"]
    I --> J{¿Admin selecciona<br/>un cliente?}
    J -- No --> F
    J -- Sí --> K["Muestra detalle:<br/>datos personales,<br/>historial de pedidos,<br/>conexiones registradas"]
    K --> F
```

---

### DA-ADM-25: Gestionar Entregas (Vista Admin)

```mermaid
flowchart TD
    A([Inicio]) --> B[Admin accede a /entregas]
    B --> C["Frontend solicita:<br/>GET /pedidos/available<br/>GET /pedidos/mine"]
    C --> D["Tab 'Disponibles':<br/>Lista pedidos sin<br/>repartidor asignado"]
    C --> E["Tab 'Mis Entregas':<br/>Lista pedidos asignados<br/>al personal"]
    D --> F{¿Admin asigna<br/>un pedido?}
    F -- Sí --> G["POST /pedidos/:id/assign"]
    G --> H[Pedido asignado al admin]
    F -- No --> I[Supervisa el estado]
    E --> J{¿Actualiza estado?}
    J -- preparado --> K["PUT status = en_camino"]
    J -- en_camino --> L["PUT status = entregado"]
    J -- No --> I
    K --> I
    L --> I
    H --> I
    I --> M([Fin])
```
