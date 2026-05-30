# 📋 Diagramas de Casos de Uso por Módulo — Sistema Globy

> **Nota para la UNERG:** Este documento contiene la especificación funcional en notación UML 2.5 pura utilizando PlantUML. Se han incorporado las directivas `skinparam actorStyle stickman` y `skinparam monochrome true` para renderizar el diagrama estrictamente en formato académico y se han definido correctamente las fronteras del sistema (`package`).

A continuación, se presentan los bloques de código PlantUML separados por módulo. Puedes copiarlos y pegarlos directamente en [PlantText](https://www.planttext.com/) o en tu IDE.

## Módulo 1: Autenticación, Seguridad y Acceso
```plantuml
' =========================================
' MODULO 1: Autenticacion, Seguridad y Acceso
' =========================================
@startuml M01_Autenticacion
skinparam actorStyle stickman
skinparam monochrome true

package "Modulo 1: Autenticacion, Seguridad y Acceso" {
    usecase "Iniciar Sesion Personal" as UC1_1
    usecase "Iniciar Sesion Cliente" as UC1_2
    usecase "Registrar Cliente" as UC1_3
    
    usecase "Validar Credenciales" as UC1_4
}

actor "Administrador" as Admin
actor "Gerente" as Gerente
actor "Trabajador" as Trabajador
actor "Delivery" as Delivery
actor "Cliente" as Cliente

Admin --> UC1_1
Gerente --> UC1_1
Trabajador --> UC1_1
Delivery --> UC1_1

Cliente --> UC1_2
Cliente --> UC1_3

UC1_1 ..> UC1_4 : <<include>>
UC1_2 ..> UC1_4 : <<include>>

note bottom of UC1_1 : Entidades:\n- Personal
note bottom of UC1_2 : Entidades:\n- Cliente
@enduml
```

## Módulo 2: Gestión de Sucursales
```plantuml
' =========================================
' MODULO 2: Gestion de Sucursales
' =========================================
@startuml M02_Sucursales
skinparam actorStyle stickman
skinparam monochrome true

package "Modulo 2: Gestion de Sucursales" {
    usecase "Crear Sucursal" as UC2_1
    usecase "Editar Sucursal" as UC2_2
    usecase "Listar Sucursales" as UC2_3
    usecase "Ver Detalles de Sucursal" as UC2_4
}

actor "Administrador" as Admin
actor "Gerente" as Gerente

Admin --> UC2_1
Admin --> UC2_2
Admin --> UC2_3
Admin --> UC2_4

Gerente --> UC2_3
Gerente --> UC2_4

note bottom of UC2_1 : Entidades:\n- Sucursal
@enduml
```

## Módulo 3: Productos e Inventario
```plantuml
' =========================================
' MODULO 3: Productos e Inventario
' =========================================
@startuml M03_Productos_Inventario
skinparam actorStyle stickman
skinparam monochrome true

package "Modulo 3: Productos e Inventario" {
    usecase "Crear Producto" as UC3_1
    usecase "Editar Producto" as UC3_2
    usecase "Listar Categorias" as UC3_3
    usecase "Actualizar Stock por\nSucursal mediante Upsert" as UC3_4
}

actor "Administrador" as Admin
actor "Gerente" as Gerente
actor "Trabajador" as Trabajador

Admin --> UC3_1
Admin --> UC3_2
Admin --> UC3_4
Admin --> UC3_3

Gerente --> UC3_3
Trabajador --> UC3_3

note bottom of UC3_1 : Entidades:\n- Producto\n- Categoria\n- Inventario
@enduml
```

## Módulo 4: Gestión de Personal
```plantuml
' =========================================
' MODULO 4: Gestion de Personal
' =========================================
@startuml M04_Gestion_Personal
skinparam actorStyle stickman
skinparam monochrome true

package "Modulo 4: Gestion de Personal" {
    usecase "Registrar Personal" as UC4_1
    usecase "Asignar Rol" as UC4_2
    usecase "Asociar a Sucursal" as UC4_3
    usecase "Modificar Estatus" as UC4_4
}

actor "Administrador" as Admin

Admin --> UC4_1
Admin --> UC4_4

UC4_1 ..> UC4_2 : <<include>>
UC4_1 ..> UC4_3 : <<include>>

note bottom of UC4_1 : Entidades:\n- Personal
@enduml
```

## Módulo 5: Gestión de Clientes
```plantuml
' =========================================
' MODULO 5: Gestion de Clientes
' =========================================
@startuml M05_Gestion_Clientes
skinparam actorStyle stickman
skinparam monochrome true

package "Modulo 5: Gestion de Clientes" {
    usecase "Visualizar Clientes" as UC5_1
    usecase "Clasificar Perfil de Cliente" as UC5_2
    usecase "Actualizar Datos Personales" as UC5_3
    
    usecase "Clasificar como Bronce" as UC5_4
    usecase "Clasificar como Plata" as UC5_5
    usecase "Clasificar como Oro" as UC5_6
}

actor "Administrador" as Admin
actor "Gerente" as Gerente
actor "Cliente" as Cliente

Admin --> UC5_1
Admin --> UC5_2

Gerente --> UC5_1

Cliente --> UC5_3

UC5_2 ..> UC5_4 : <<extend>>
UC5_2 ..> UC5_5 : <<extend>>
UC5_2 ..> UC5_6 : <<extend>>

note bottom of UC5_1 : Entidades:\n- Cliente
@enduml
```

## Módulo 6: Pedidos y Logística de Entregas
```plantuml
' =========================================
' MODULO 6: Pedidos y Logistica de Entregas
' =========================================
@startuml M06_Pedidos_Entregas
skinparam actorStyle stickman
skinparam monochrome true

package "Modulo 6: Pedidos y Logistica de Entregas" {
    usecase "Realizar Pedido" as UC6_1
    usecase "Listar Pedidos Disponibles" as UC6_2
    usecase "Asignar Repartidor" as UC6_3
    usecase "Actualizar Estado del Pedido" as UC6_4
    
    usecase "Marcar Pendiente" as UC6_5
    usecase "Marcar Preparado" as UC6_6
    usecase "Marcar En Camino" as UC6_7
    usecase "Marcar Entregado" as UC6_8
}

actor "Cliente" as Cliente
actor "Trabajador" as Trabajador
actor "Delivery" as Delivery

Cliente --> UC6_1
Trabajador --> UC6_1

Delivery --> UC6_2
Delivery --> UC6_3
Delivery --> UC6_4

UC6_4 ..> UC6_5 : <<extend>>
UC6_4 ..> UC6_6 : <<extend>>
UC6_4 ..> UC6_7 : <<extend>>
UC6_4 ..> UC6_8 : <<extend>>

note bottom of UC6_1 : Entidades:\n- Pedido\n- PedidoDetalle
@enduml
```

## Módulo 7: Conexiones y Sensor Geo
```plantuml
' =========================================
' MODULO 7: Conexiones y Sensor Geo
' =========================================
@startuml M07_Conexiones_Sensor_Geo
skinparam actorStyle stickman
skinparam monochrome true

package "Modulo 7: Conexiones y Sensor Geo" {
    usecase "Capturar Datos de Conexion\nde forma silenciosa" as UC7_1
    usecase "Extraer IP" as UC7_2
    usecase "Extraer Latitud y Longitud" as UC7_3
    usecase "Identificar Dispositivo" as UC7_4
}

actor "Sistema" as Sistema

Sistema --> UC7_1

UC7_1 ..> UC7_2 : <<include>>
UC7_1 ..> UC7_3 : <<include>>
UC7_1 ..> UC7_4 : <<include>>

note bottom of UC7_1 : Entidades:\n- Conexion
@enduml
```

## Módulo 8: Análisis con Inteligencia Artificial (Globy)
```plantuml
' =========================================
' MODULO 8: Analisis con Inteligencia Artificial (Globy)
' =========================================
@startuml M08_Analisis_IA
skinparam actorStyle stickman
skinparam monochrome true

package "Modulo 8: Analisis con Inteligencia Artificial" {
    usecase "Generar Reporte de Patrones" as UC8_1
    usecase "Detectar Zonas de Demanda\n[Hot Spots]" as UC8_2
    usecase "Analizar Comportamiento de Compra" as UC8_3
    usecase "Exportar Reporte a PDF" as UC8_4
}

actor "Administrador" as Admin
actor "Gerente" as Gerente

Admin --> UC8_1
Admin --> UC8_2
Admin --> UC8_3
Admin --> UC8_4

Gerente --> UC8_1
Gerente --> UC8_2
Gerente --> UC8_3
Gerente --> UC8_4

note bottom of UC8_1 : Entidades:\n- InformeAnalitico\n- Competidor
@enduml
```

## Módulo 9: Configuración del Sistema y Soporte
```plantuml
' =========================================
' MODULO 9: Configuracion del Sistema y Soporte
' =========================================
@startuml M09_Configuracion_Soporte
skinparam actorStyle stickman
skinparam monochrome true

package "Modulo 9: Configuracion del Sistema y Soporte" {
    usecase "Editar Datos Fiscales" as UC9_1
    usecase "Subir Logo Institucional" as UC9_2
    usecase "Configurar Servidor SMTP" as UC9_3
}

actor "Administrador" as Admin

Admin --> UC9_1
Admin --> UC9_2
Admin --> UC9_3

note bottom of UC9_1 : Entidades:\n- EmpresaConfig
@enduml
```
