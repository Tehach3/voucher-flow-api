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
| `cuponesMinimos` | integer | Sí | Mínimo de cupones que debe acumular un participante para estar en el sorteo (mínimo 1) |
| `descripcion` | string | No | Descripción larga de la campaña |
| `tieneCondicionesMultiples` | boolean | No | `true` si hay diferentes cupones según el SKU del producto. `false` si hay una sola regla para todos los SKUs |
| `condicionesCupones` | array | No | Reglas de cupones por SKU. Si `tieneCondicionesMultiples=false`, exactamente 1 elemento. Si `true`, uno por cada SKU válido |
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
    "descripcion": "Registra tus compras de productos y acumula cupones para el sorteo",
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
  "descripcion": "Registra tus compras de productos y acumula cupones para el sorteo",
  "estado": "pendiente",
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
      "estado": "pendiente",
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

Devuelve únicamente los eventos activos, con el estado calculado dinámicamente en base a las fechas. Es el endpoint que debe consultar el frontend para mostrar las campañas en las que un usuario puede participar.

### Estados posibles

| Estado calculado | Significado |
|-----------------|-------------|
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

### Campos relevantes de la respuesta

| Campo | Descripción |
|-------|-------------|
| `id` | Identificador del evento — requerido para registrar tickets |
| `nombre` | Nombre de la campaña |
| `estado` | Estado calculado en tiempo real (`vigente`, `no_iniciado`, etc.) |
| `fechaInicio` | Desde cuándo se aceptan tickets |
| `fechaVencimiento` | Hasta cuándo se aceptan tickets |
| `cuponesMinimos` | Cupones mínimos para participar en el sorteo |
| `condicionesCupones` | Cupones que genera cada SKU de producto |
| `premios` | Lista de premios disponibles |
| `imagenUrl` | Banner de la campaña (para mostrar en frontend) |

---

## 4. Registrar un ticket para un participante

**`POST /api/tickets`**

Registra la compra de un participante en una campaña. El sistema:

1. Crea al participante si no existe (usando la cédula como identificador único)
2. Crea la participación en el evento si es la primera vez
3. Verifica que el ticket no sea duplicado
4. Calcula los cupones según los productos y el evento
5. Acumula los cupones en la participación del usuario

### Campos del body

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `cedula` | string | Sí | Cédula del participante (máx 10 dígitos) — es el identificador único |
| `nombre` | string | Sí (primer registro) | Nombre completo. En registros posteriores es opcional |
| `celular` | string | No | Número de teléfono |
| `ciudad` | string | No | Ciudad del participante |
| `email` | string | No | Correo electrónico |
| `eventoId` | integer | Sí | ID del evento obtenido del paso anterior |
| `numeroTicket` | string | Sí | Número de la factura o ticket de compra |
| `local` | string | Sí | Nombre del establecimiento donde se realizó la compra |
| `multiplicador` | boolean | No (default `false`) | `true` si el local tiene beneficio multiplicador de cupones |
| `coeficienteMultiplicador` | integer | Sí si `multiplicador=true` | Factor de multiplicación (mínimo 2) |
| `fotoBase64` | string | Sí | Imagen del ticket en formato Data URI base64 (ver sección siguiente) |
| `productos` | array | Sí | Lista de productos del ticket |
| `productos[].sku` | string | Sí | SKU del producto: `250g`, `500g`, `1kg` o `5kg` |
| `productos[].cantidad` | integer | Sí | Unidades compradas (mínimo 1) |

### Cálculo de cupones

Los cupones se calculan según las `condicionesCupones` del evento:

```
cuponesBase = cuponesPorUnidad × cantidad
cuponesGenerados = multiplicador ? cuponesBase × coeficienteMultiplicador : cuponesBase
```

Ejemplo sin multiplicador: 2 unidades de `1kg` con 5 cupones/unidad = **10 cupones**  
Ejemplo con multiplicador ×2: 2 unidades de `1kg` = 10 base × 2 = **20 cupones**

### Ejemplo de request

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "x-api-key: mi_clave_secreta" \
  -H "Content-Type: application/json" \
  -d '{
    "cedula": "12345678",
    "nombre": "María López",
    "celular": "04141234567",
    "ciudad": "Caracas",
    "email": "maria@email.com",
    "eventoId": 1,
    "numeroTicket": "FAC-2026-00123",
    "local": "Super 6 La Negrita",
    "multiplicador": false,
    "fotoBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA...",
    "productos": [
      { "sku": "1kg",  "cantidad": 2 },
      { "sku": "5kg",  "cantidad": 1 }
    ]
  }'
```

### Respuesta exitosa (`201 Created`)

```json
{
  "mensaje": "Participante registrado y cupones asignados correctamente",
  "esUsuarioNuevo": true,
  "cedula": "12345678",
  "nombre": "María López",
  "eventoId": 1,
  "numeroTicket": "FAC-2026-00123",
  "local": "Super 6 La Negrita",
  "multiplicadorAplicado": false,
  "coeficienteAplicado": 1,
  "fotoUrl": "https://res.cloudinary.com/demo/image/upload/v1/sorteos/facturas/12345678/foto.jpg",
  "productos": [
    { "sku": "1kg",  "cantidad": 2, "cuponesBase": 10, "coeficienteAplicado": 1, "cuponesGenerados": 10 },
    { "sku": "5kg",  "cantidad": 1, "cuponesBase": 15, "coeficienteAplicado": 1, "cuponesGenerados": 15 }
  ],
  "cuponesGenerados": 25,
  "cuponesAcumulados": 25
}
```

### Errores comunes

| Código | Causa |
|--------|-------|
| `400` | Datos inválidos, evento no activo, SKU no válido para el evento, o imagen con formato incorrecto |
| `409` | El mismo número de ticket ya fue registrado por este participante en esta campaña |
| `413` | La imagen supera el límite de 10 MB |
| `503` | Error transitorio al guardar — el ticket queda en cola pendiente para reintento automático |

---

## 5. Cómo preparar la imagen en base64

El campo `fotoBase64` debe ser un **Data URI** con el siguiente formato:

```
data:image/jpeg;base64,<datos en base64>
```

### Desde el frontend (JavaScript / TypeScript)

```javascript
// El usuario seleccionó un archivo con <input type="file">
const file = inputElement.files[0];

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

### Recomendaciones

| Recomendación | Detalle |
|---------------|---------|
| Formato | JPEG o PNG |
| Tamaño máximo del archivo original | 5 MB |
| Tamaño máximo del string base64 | ~6.8 MB (el límite de la API es 10 MB) |
| Orientación | Asegurarse de que la imagen esté legible antes de enviar |
| Compresión | Comprimir la imagen en el frontend si supera los 3 MB para mejorar la velocidad de carga |

### Ejemplo de prueba con curl (imagen real)

```bash
# Convertir imagen a base64 y armar el Data URI
FOTO=$(echo "data:image/jpeg;base64,$(base64 -w 0 foto-ticket.jpg)")

curl -X POST http://localhost:3000/api/tickets \
  -H "x-api-key: mi_clave_secreta" \
  -H "Content-Type: application/json" \
  -d "{
    \"cedula\": \"12345678\",
    \"eventoId\": 1,
    \"numeroTicket\": \"FAC-001\",
    \"local\": \"Tienda Centro\",
    \"fotoBase64\": \"$FOTO\",
    \"productos\": [{ \"sku\": \"1kg\", \"cantidad\": 1 }]
  }"
```

---

## 6. Consultar cupones de un participante

### 6.1 Todas las campañas de un participante

**`GET /api/tickets/:cedula/cupones`**

Devuelve un resumen de todas las campañas en que el participante ha registrado tickets, con los cupones que generó en cada una.

```bash
curl "http://localhost:3000/api/tickets/12345678/cupones" \
  -H "x-api-key: mi_clave_secreta"
```

**Respuesta:**

```json
{
  "cedula": "12345678",
  "nombre": "María López",
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
          "multiplicador": false,
          "coeficienteMultiplicador": null,
          "sku": "1kg",
          "cantidad": 2,
          "cuponesBase": 10,
          "cuponesGenerados": 10,
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

Detalle de cupones de un participante en una campaña concreta.

```bash
curl "http://localhost:3000/api/tickets/12345678/evento/1" \
  -H "x-api-key: mi_clave_secreta"
```

**Respuesta:**

```json
{
  "cedula": "12345678",
  "eventoId": 1,
  "cuponesAcumulados": 50,
  "totalFacturas": 3,
  "facturas": [
    {
      "id": 1,
      "participanteId": 42,
      "eventoId": 1,
      "participacionId": 7,
      "numeroTicket": "FAC-2026-00123",
      "local": "Super 6 La Negrita",
      "multiplicador": false,
      "coeficienteMultiplicador": null,
      "sku": "1kg",
      "cantidad": 2,
      "cuponesBase": 10,
      "cuponesGenerados": 10,
      "fotoUrl": "https://res.cloudinary.com/.../foto.jpg",
      "ocrData": null,
      "activo": true,
      "fechaCarga": "2026-04-12T10:05:00.000Z"
    }
  ]
}
```

### Campos de la respuesta de cupones

| Campo | Descripción |
|-------|-------------|
| `cuponesAcumulados` | Total de cupones que tiene el participante en esa campaña |
| `totalFacturas` | Cantidad de tickets registrados |
| `numeroTicket` | Número de la factura o ticket físico |
| `cuponesBase` | Cupones calculados antes de aplicar multiplicador |
| `cuponesGenerados` | Cupones finales (después de multiplicador si aplica) |
| `multiplicador` | Si se aplicó beneficio de multiplicador en ese local |
| `coeficienteMultiplicador` | Factor aplicado (`null` si no hubo multiplicador) |
| `fotoUrl` | URL de la imagen del comprobante almacenada en Cloudinary |
| `ocrData` | Datos extraídos por OCR de la imagen (puede ser `null`) |

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
                                │ cupones generados y acumulados
                                ▼
5. Consultar cupones     GET  /api/tickets/:cedula/cupones
                         GET  /api/tickets/:cedula/evento/:eventoId
```
