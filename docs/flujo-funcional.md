# Guía funcional — Voucher Flow API

Esta guía recorre el flujo completo de uso de la API: desde crear una campaña hasta consultar los cupones generados por un participante.

Todos los ejemplos usan `curl`. Sustituir:
- `http://localhost:3000` por la URL real del servidor
- `mi_clave_secreta` por el valor de `API_KEY` en `.env`

---

## Índice

1. [Crear un evento (campaña)](#1-crear-un-evento-campaña)
2. [Listar todos los eventos](#2-listar-todos-los-eventos)
3. [Listar eventos disponibles (vigentes)](#3-listar-eventos-disponibles-vigentes)
4. [Registrar un ticket para un participante](#4-registrar-un-ticket-para-un-participante)
5. [Cómo preparar la imagen en base64](#5-cómo-preparar-la-imagen-en-base64)
6. [Consultar cupones de un participante](#6-consultar-cupones-de-un-participante)
7. [Listar todos los tickets (backoffice)](#7-listar-todos-los-tickets-backoffice)
8. [Gestión de participantes](#8-gestión-de-participantes)
9. [Tickets pendientes y reintentos](#9-tickets-pendientes-y-reintentos)
10. [Validaciones y errores comunes](#10-validaciones-y-errores-comunes)

---

## 1. Crear un evento (campaña)

**`POST /api/eventos`**

Un evento representa una campaña de sorteo. Define el período en que los participantes pueden registrar tickets, las condiciones de cupones y los premios.

### Campos

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `nombre` | string | Sí | Nombre visible de la campaña (2–255 caracteres) |
| `fechaInicio` | string (ISO 8601) | Sí | Fecha y hora en que empieza a aceptar tickets |
| `fechaCierre` | string (ISO 8601) | Sí | Fecha y hora límite para registrar tickets |
| `cuponesMinimos` | integer | Sí | Mínimo de cupones para estar en el sorteo (mínimo 1) |
| `descripcion` | string | No | Descripción larga de la campaña |
| `tieneCondicionesMultiples` | boolean | No | `true` si hay diferentes cupones según el SKU. `false` si la regla es igual para todos |
| `condicionesCupones` | array | No | Reglas de cupones por SKU (ver detalle abajo) |
| `premios` | array | No | Lista de premios del sorteo |
| `imagenUrl` | string (URL) | No | Banner o imagen de la campaña |

**SKUs válidos:** `250g`, `500g`, `1kg`, `5kg`

### Ejemplo — campaña con condiciones múltiples por SKU

```bash
curl -X POST http://localhost:3000/api/eventos \
  -H "x-api-key: mi_clave_secreta" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Sorteo Verano 2026",
    "descripcion": "Registra tus compras y acumula cupones para el sorteo",
    "fechaInicio": "2026-05-01T00:00:00Z",
    "fechaCierre": "2026-08-31T23:59:59Z",
    "cuponesMinimos": 5,
    "tieneCondicionesMultiples": true,
    "condicionesCupones": [
      { "sku": "250g", "cuponesPorUnidad": 2 },
      { "sku": "500g", "cuponesPorUnidad": 3 },
      { "sku": "1kg",  "cuponesPorUnidad": 5 },
      { "sku": "5kg",  "cuponesPorUnidad": 15 }
    ],
    "premios": [
      { "descripcion": "Viaje a Cancún para 2 personas", "orden": 1 },
      { "descripcion": "TV 55 pulgadas", "orden": 2 },
      { "descripcion": "Licuadora profesional", "orden": 3 }
    ],
    "imagenUrl": "https://example.com/banner-verano.jpg"
  }'
```

### Respuesta exitosa (`201 Created`)

```json
{
  "id": 1,
  "nombre": "Sorteo Verano 2026",
  "descripcion": "Registra tus compras y acumula cupones para el sorteo",
  "estado": "no_iniciado",
  "fechaInicio": "2026-05-01T00:00:00.000Z",
  "fechaVencimiento": "2026-08-31T23:59:59.000Z",
  "cuponesMinimos": 5,
  "tieneCondicionesMultiples": true,
  "condicionesCupones": [
    { "sku": "250g", "cuponesPorUnidad": 2 },
    { "sku": "500g", "cuponesPorUnidad": 3 },
    { "sku": "1kg",  "cuponesPorUnidad": 5 },
    { "sku": "5kg",  "cuponesPorUnidad": 15 }
  ],
  "premios": [
    { "descripcion": "Viaje a Cancún para 2 personas", "orden": 1 },
    { "descripcion": "TV 55 pulgadas", "orden": 2 },
    { "descripcion": "Licuadora profesional", "orden": 3 }
  ],
  "activo": true,
  "imagenUrl": "https://example.com/banner-verano.jpg",
  "fechaRegistro": "2026-04-12T10:00:00.000Z",
  "fechaActualizacion": "2026-04-12T10:00:00.000Z"
}
```

> Anotar el `id` del evento — se necesita en los siguientes pasos.

---

## 2. Listar todos los eventos

**`GET /api/eventos`**

Devuelve todos los eventos registrados, paginados. No filtra por estado — incluye pendientes, vigentes, vencidos y cerrados.

### Parámetros de query (opcionales)

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Número de página |
| `limit` | integer | 20 | Cantidad de resultados por página |

### Ejemplo

```bash
curl "http://localhost:3000/api/eventos?page=1&limit=10" \
  -H "x-api-key: mi_clave_secreta"
```

### Respuesta

```json
{
  "data": [
    {
      "id": 1,
      "nombre": "Sorteo Verano 2026",
      "estado": "vigente",
      "fechaInicio": "2026-05-01T00:00:00.000Z",
      "fechaVencimiento": "2026-08-31T23:59:59.000Z",
      "cuponesMinimos": 5,
      "activo": true
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

---

## 3. Listar eventos disponibles (vigentes)

**`GET /api/eventos/disponibles`**

Devuelve únicamente los eventos activos. El estado se calcula dinámicamente en base a las fechas — es el endpoint que debe consultar el frontend para mostrar las campañas en las que un usuario puede participar.

### Estados posibles

| Estado | Significado |
|--------|-------------|
| `vigente` | Dentro del rango de fechas — acepta tickets ahora mismo |
| `no_iniciado` | La `fechaInicio` aún no ha llegado |
| `vencido` | La `fechaCierre` ya pasó |
| `cerrado` | Cerrado manualmente por un administrador |

### Parámetro de query (opcional)

| Parámetro | Valores | Default | Descripción |
|-----------|---------|---------|-------------|
| `estado` | `vigente`, `no_iniciado`, `vencido`, `cerrado` | — | Sin este parámetro retorna solo los `vigente` |

### Ejemplo — solo los que aceptan tickets ahora

```bash
curl "http://localhost:3000/api/eventos/disponibles" \
  -H "x-api-key: mi_clave_secreta"
```

### Ejemplo — ver también los próximos (no iniciados)

```bash
curl "http://localhost:3000/api/eventos/disponibles?estado=no_iniciado" \
  -H "x-api-key: mi_clave_secreta"
```

---

## 4. Registrar un ticket para un participante

**`POST /api/tickets`**

Registra la compra de un participante en una campaña. El sistema ejecuta las siguientes fases en orden:

```
Fase 0  Verificar unicidad de imagen (foto_hash) — solo si SECURITY_IMAGE_HASH_ENABLED=true
Fase 1  Validar que el evento esté activo y vigente
Fase 2  Validar que los SKUs sean válidos para el evento
Fase 3  Verificar que el número de ticket no se haya usado en esta campaña
Fase 4  Buscar o crear el participante por cédula
Fase 5  Crear la participación en el evento si es la primera vez
Fase 6  Subir imagen a Cloudinary
Fase 7  Guardar ticket(s) en BD y acumular cupones
```

Las fases 0–5 fallan con `4xx` y nunca guardan pendientes. Las fases 6–7 fallan con `503` y guardan el ticket en `tickets_pendientes` para reintento.

### Campos del body

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `cedula` | string | Sí | Cédula del participante (máx 10 caracteres) — identificador único |
| `nombre` | string | Sí (primer registro) | Nombre completo. En registros posteriores es opcional |
| `celular` | string | No | Número de teléfono |
| `ciudad` | string | No | Ciudad del participante |
| `email` | string | No | Correo electrónico |
| `eventoId` | integer | Sí | ID del evento |
| `numeroTicket` | string | Sí | Número de la factura o ticket de compra (máx 50 caracteres) |
| `local` | string | Sí | Nombre del establecimiento donde se realizó la compra |
| `multiplicador` | boolean | No (default `false`) | `true` si el local tiene beneficio multiplicador de cupones |
| `coeficienteMultiplicador` | integer | Sí si `multiplicador=true` | Factor de multiplicación (mínimo 2) |
| `fotoBase64` | string | Sí | Imagen del ticket como Data URI base64 (ver sección 5) |
| `productos` | array | Sí | Lista de productos del ticket (al menos 1) |
| `productos[].sku` | string | Sí | SKU: `250g`, `500g`, `1kg` o `5kg` |
| `productos[].cantidad` | integer | Sí | Unidades compradas (mínimo 1) |

### Cálculo de cupones

Los cupones se calculan según las `condicionesCupones` del evento:

```
cuponesBase      = cuponesPorUnidad × cantidad
cuponesGenerados = multiplicador && coeficiente >= 2
                     ? cuponesBase × coeficiente
                     : cuponesBase
```

Ejemplo sin multiplicador: 2 unidades de `1kg` con 5 cupones/unidad = **10 cupones**  
Ejemplo con multiplicador ×2: igual que antes = 10 base × 2 = **20 cupones**

### Ejemplo de request

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "x-api-key: mi_clave_secreta" \
  -H "Content-Type: application/json" \
  -d '{
    "cedula": "4345493",
    "nombre": "María López",
    "celular": "0971234567",
    "ciudad": "Asuncion",
    "email": "maria@email.com",
    "eventoId": 1,
    "numeroTicket": "FAC-2026-00123",
    "local": "Super 6 La Negrita",
    "multiplicador": true,
    "coeficienteMultiplicador": 2,
    "fotoBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA...",
    "productos": [
      { "sku": "1kg", "cantidad": 2 },
      { "sku": "5kg", "cantidad": 1 }
    ]
  }'
```

### Respuesta exitosa (`201 Created`)

```json
{
  "mensaje": "Participante registrado y cupones asignados correctamente",
  "esUsuarioNuevo": true,
  "eventoId": 1,
  "numeroTicket": "FAC-2026-00123",
  "local": "Super 6 La Negrita",
  "multiplicadorAplicado": true,
  "coeficienteAplicado": 2,
  "fotoUrl": "https://res.cloudinary.com/demo/image/upload/v1/sorteos/4345493/foto.jpg",
  "productos": [
    { "sku": "1kg",  "cantidad": 2, "cuponesBase": 10, "coeficienteAplicado": 2, "cuponesGenerados": 20 },
    { "sku": "5kg",  "cantidad": 1, "cuponesBase": 15, "coeficienteAplicado": 2, "cuponesGenerados": 30 }
  ],
  "cuponesGenerados": 50,
  "cuponesAcumulados": 50
}
```

> `esUsuarioNuevo: true` indica que el participante fue creado en este request. En registros posteriores del mismo participante será `false`.

### Detección de comprobantes duplicados

Cuando `SECURITY_IMAGE_HASH_ENABLED=true`, el sistema calcula un hash SHA-256 de la imagen antes de cualquier otra operación. Si ese hash ya existe en la campaña — independientemente del participante o número de ticket — el request es rechazado:

```json
{
  "statusCode": 409,
  "message": "Esta imagen ya fue utilizada en esta campaña"
}
```

Esto ocurre en la Fase 0, **antes** del upload a Cloudinary.

---

## 5. Cómo preparar la imagen en base64

El campo `fotoBase64` debe ser un **Data URI** con el siguiente formato:

```
data:image/jpeg;base64,<datos en base64>
```

### Desde el frontend (JavaScript / TypeScript)

```javascript
const file = inputElement.files[0]; // archivo seleccionado con <input type="file">

const reader = new FileReader();
reader.onload = (event) => {
  const fotoBase64 = event.target.result; // "data:image/jpeg;base64,/9j/4AAQ..."
  // Usar fotoBase64 en el body del POST /api/tickets
};
reader.readAsDataURL(file);
```

### Desde Node.js (para pruebas o scripts)

```javascript
const fs = require('fs');
const buffer = fs.readFileSync('./foto-ticket.jpg');
const fotoBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
```

### Desde Python (para pruebas)

```python
import base64

with open('foto-ticket.jpg', 'rb') as f:
    encoded = base64.b64encode(f.read()).decode('utf-8')

foto_base64 = f'data:image/jpeg;base64,{encoded}'
```

### Ejemplo con curl (imagen real)

```bash
FOTO=$(echo "data:image/jpeg;base64,$(base64 -w 0 foto-ticket.jpg)")

curl -X POST http://localhost:3000/api/tickets \
  -H "x-api-key: mi_clave_secreta" \
  -H "Content-Type: application/json" \
  -d "{
    \"cedula\": \"4345493\",
    \"eventoId\": 1,
    \"numeroTicket\": \"FAC-001\",
    \"local\": \"Tienda Centro\",
    \"fotoBase64\": \"$FOTO\",
    \"productos\": [{ \"sku\": \"1kg\", \"cantidad\": 1 }]
  }"
```

### Recomendaciones

| Recomendación | Detalle |
|---------------|---------|
| Formato | JPEG o PNG |
| Tamaño máximo del archivo original | 5 MB |
| Tamaño máximo del string base64 | ~6.8 MB (límite de la API: 10 MB) |
| Compresión | Comprimir en el frontend si supera los 3 MB |

---

## 6. Consultar cupones de un participante

### 6.1 Todas las campañas

**`GET /api/tickets/:cedula/cupones`**

```bash
curl "http://localhost:3000/api/tickets/4345493/cupones" \
  -H "x-api-key: mi_clave_secreta"
```

**Respuesta:**

```json
{
  "campanhas": [
    {
      "eventoId": 1,
      "nombre": "Sorteo Verano 2026",
      "cuponesAcumulados": 50,
      "facturas": [
        {
          "id": 1,
          "numeroTicket": "FAC-2026-00123",
          "local": "Super 6 La Negrita",
          "multiplicador": true,
          "coeficienteMultiplicador": 2,
          "sku": "1kg",
          "cantidad": 2,
          "cuponesBase": 10,
          "cuponesGenerados": 20,
          "fotoUrl": "https://res.cloudinary.com/.../foto.jpg",
          "fechaCarga": "2026-04-12T10:05:00.000Z"
        }
      ]
    }
  ]
}
```

### 6.2 Una campaña específica

**`GET /api/tickets/:cedula/evento/:eventoId`**

```bash
curl "http://localhost:3000/api/tickets/4345493/evento/1" \
  -H "x-api-key: mi_clave_secreta"
```

**Respuesta:**

```json
{
  "eventoId": 1,
  "cuponesAcumulados": 50,
  "totalFacturas": 2,
  "facturas": [
    {
      "id": 1,
      "numeroTicket": "FAC-2026-00123",
      "local": "Super 6 La Negrita",
      "multiplicador": true,
      "coeficienteMultiplicador": 2,
      "sku": "1kg",
      "cantidad": 2,
      "cuponesBase": 10,
      "cuponesGenerados": 20,
      "fotoUrl": "https://res.cloudinary.com/.../foto.jpg",
      "ocrData": null,
      "activo": true,
      "fechaCarga": "2026-04-12T10:05:00.000Z"
    }
  ]
}
```

### Campos de los tickets en la respuesta

| Campo | Descripción |
|-------|-------------|
| `cuponesAcumulados` | Total de cupones del participante en esa campaña |
| `totalFacturas` | Cantidad de filas de ticket registradas |
| `numeroTicket` | Número de la factura o ticket físico |
| `cuponesBase` | Cupones calculados antes de aplicar multiplicador |
| `cuponesGenerados` | Cupones finales (después del multiplicador si aplica) |
| `multiplicador` | Si se aplicó beneficio de multiplicador |
| `coeficienteMultiplicador` | Factor aplicado (`null` si no hubo multiplicador) |
| `fotoUrl` | URL de la imagen en Cloudinary |
| `ocrData` | Datos extraídos por OCR (`null` si no se procesó) |

---

## 7. Listar todos los tickets (backoffice)

**`GET /api/tickets`**

Lista paginada de todos los tickets con filtros. No expone PII — solo devuelve `ciudad` del participante.

### Parámetros de query (todos opcionales)

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `cedula` | string | Filtrar por cédula del participante |
| `ciudad` | string | Filtrar por ciudad (búsqueda parcial, insensible a mayúsculas) |
| `fechaDesde` | string (ISO 8601) | Tickets cargados desde esta fecha |
| `fechaHasta` | string (ISO 8601) | Tickets cargados hasta esta fecha (inclusive hasta las 23:59:59) |
| `page` | integer | Página (default 1) |
| `limit` | integer | Resultados por página (default 20) |

### Ejemplo

```bash
curl "http://localhost:3000/api/tickets?ciudad=Asuncion&fechaDesde=2026-04-01&page=1&limit=20" \
  -H "x-api-key: mi_clave_secreta"
```

### Respuesta

```json
{
  "data": [
    {
      "id": 1,
      "ciudad": "Asuncion",
      "eventoId": 1,
      "eventoNombre": "Sorteo Verano 2026",
      "numeroTicket": "FAC-2026-00123",
      "local": "Super 6 La Negrita",
      "multiplicador": true,
      "coeficienteMultiplicador": 2,
      "sku": "1kg",
      "cantidad": 2,
      "cuponesBase": 10,
      "cuponesGenerados": 20,
      "fotoUrl": "https://res.cloudinary.com/.../foto.jpg",
      "fechaCarga": "2026-04-12T10:05:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

---

## 8. Gestión de participantes

### 8.1 Listar participantes

**`GET /api/participantes`**

Solo devuelve `ciudad` por participante — no expone ningún otro dato personal.

```bash
curl "http://localhost:3000/api/participantes?page=1&limit=20" \
  -H "x-api-key: mi_clave_secreta"
```

```json
{
  "data": [{ "ciudad": "Asuncion" }, { "ciudad": "Ciudad del Este" }],
  "total": 2,
  "page": 1,
  "limit": 20
}
```

### 8.2 Ver un participante

**`GET /api/participantes/:cedula`**

```bash
curl "http://localhost:3000/api/participantes/4345493" \
  -H "x-api-key: mi_clave_secreta"
```

```json
{ "ciudad": "Asuncion" }
```

### 8.3 Actualizar un participante

**`PATCH /api/participantes/:cedula`**

Permite actualizar `nombre`, `celular`, `ciudad` y/o `email`. Solo se actualizan los campos enviados.

```bash
curl -X PATCH http://localhost:3000/api/participantes/4345493 \
  -H "x-api-key: mi_clave_secreta" \
  -H "Content-Type: application/json" \
  -d '{ "ciudad": "Encarnacion" }'
```

```json
{ "ciudad": "Encarnacion" }
```

---

## 9. Tickets pendientes y reintentos

Si Cloudinary falla (Fase 6) o la escritura en BD falla (Fase 7), el ticket se guarda en `tickets_pendientes` y la API responde `503`:

```json
{
  "statusCode": 503,
  "codigo": "UPLOAD_FALLIDO",
  "mensaje": "Error al procesar la imagen. Sus datos fueron guardados para reintento.",
  "pendienteId": 5
}
```

### 9.1 Listar pendientes

**`GET /api/tickets/pendientes`**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `estado` | `pendiente`, `procesando`, `completado`, `fallido_permanente` | Filtro por estado |
| `cedula` | string | Filtro por cédula |
| `eventoId` | integer | Filtro por evento |
| `page` / `limit` | integer | Paginación |

```bash
curl "http://localhost:3000/api/tickets/pendientes?estado=pendiente" \
  -H "x-api-key: mi_clave_secreta"
```

### 9.2 Reintentar un ticket individual

**`POST /api/tickets/pendientes/:id/reintentar`**

```bash
curl -X POST http://localhost:3000/api/tickets/pendientes/5/reintentar \
  -H "x-api-key: mi_clave_secreta"
```

### 9.3 Reintentar todos los pendientes

**`POST /api/tickets/pendientes/reintentar-todos`**

```bash
curl -X POST http://localhost:3000/api/tickets/pendientes/reintentar-todos \
  -H "x-api-key: mi_clave_secreta"
```

```json
{
  "procesados": 3,
  "exitosos": 2,
  "fallidos": 1,
  "resultados": [...]
}
```

> Después de `5` intentos fallidos el ticket pasa a estado `fallido_permanente` y requiere intervención manual.

---

## 10. Validaciones y errores comunes

### Errores del flujo de tickets

| Código | Causa |
|--------|-------|
| `400` | Datos inválidos, evento no activo, evento no iniciado, evento vencido, SKU no válido para esta campaña |
| `409` | Número de ticket ya registrado en esta campaña, o imagen ya utilizada en esta campaña (`SECURITY_IMAGE_HASH_ENABLED=true`) |
| `413` | Imagen supera el límite de 10 MB |
| `503` | Error transitorio al subir imagen o guardar en BD — ticket guardado en cola de reintentos |

### Errores de autenticación

| Código | Causa |
|--------|-------|
| `401` | Header `x-api-key` ausente, incorrecto, o firma HMAC inválida/expirada |

### Shape de error uniforme

Todos los errores siguen el mismo formato:

```json
{
  "statusCode": 400,
  "message": "Descripción del error",
  "path": "/api/tickets",
  "timestamp": "2026-04-13T12:00:00.000Z"
}
```

---

## Flujo completo resumido

```
1. Crear evento          POST /api/eventos
                                │
                                │ id del evento
                                ▼
2. Consultar vigentes    GET  /api/eventos/disponibles
                                │
                                │ confirmar eventoId
                                ▼
3. Preparar imagen       FileReader.readAsDataURL(file)
                                │
                                │ fotoBase64 (Data URI)
                                ▼
4. Registrar ticket      POST /api/tickets
                         { cedula, eventoId, numeroTicket,
                           local, fotoBase64, productos[] }
                                │
                         ┌──────┴──────┐
                       201 OK        503 Error
                         │           guardado en pendientes
                         │                  │
                         ▼                  ▼
5. Consultar cupones  GET /api/tickets/:cedula/cupones
                      GET /api/tickets/:cedula/evento/:eventoId

                      Reintentar pendientes:
                      POST /api/tickets/pendientes/:id/reintentar
```
