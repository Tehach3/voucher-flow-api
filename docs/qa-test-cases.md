# Plan de Pruebas QA — Voucher Flow API

**Versión:** 1.0  
**Fecha:** 2026-04-15  
**Rama base:** `develop`

---

## Índice

1. [Prerrequisitos y configuración](#1-prerrequisitos-y-configuración)
2. [Registro de ticket — `POST /api/tickets`](#2-registro-de-ticket--post-apitíckets)
3. [Listado general de tickets — `GET /api/tickets`](#3-listado-general-de-tickets--get-apitickets)
4. [Consulta de cupones por participante — `GET /api/tickets/:cedula/cupones`](#4-consulta-de-cupones-por-participante--get-apitícketscedulacupones)
5. [Consulta por participante y evento — `GET /api/tickets/:cedula/evento/:eventoId`](#5-consulta-por-participante-y-evento--get-apitícketscedulaevento-eventoid)
6. [Consulta de participantes](#6-consulta-de-participantes)
7. [Consulta de pendientes — `GET /api/tickets/pendientes`](#7-consulta-de-pendientes--get-apiticketspendientes)
8. [Reintento unitario — `POST /api/tickets/pendientes/:id/reintentar`](#8-reintento-unitario--post-apiticketspendientesidreintentar)
9. [Reintento masivo — `POST /api/tickets/pendientes/reintentar-todos`](#9-reintento-masivo--post-apiticketspendientesreintentar-todos)
10. [Seguridad y autenticación](#10-seguridad-y-autenticación)

---

## Convenciones

| Símbolo | Significado |
|---------|-------------|
| ✅ | Resultado esperado: éxito |
| ❌ | Resultado esperado: error |
| `codigo` | Campo `codigo` en el body de error |
| `HTTP NNN` | Código de estado HTTP esperado |

**Headers obligatorios en todos los endpoints (excepto `GET /api/health`):**
```
x-api-key: <API_KEY>
Content-Type: application/json
```

**Headers adicionales para `POST /api/tickets`:**
```
x-hmac-signature: <firma HMAC>
x-hmac-timestamp: <timestamp Unix>
```

---

## 1. Prerrequisitos y configuración

Antes de iniciar las pruebas verificar:

- [ ] Variable `API_KEY` configurada en `.env` y conocida por QA
- [ ] Variables HMAC (`HMAC_SECRET`) configuradas para poder firmar requests de registro
- [ ] Al menos **un evento activo** en la BD con `activo=true` y fechas vigentes (conocer su `id`)
- [ ] Al menos **un evento inactivo** (`activo=false`) y su `id`
- [ ] Al menos **un evento con condiciones de cupones** definidas (`condicionesCupones` con SKUs específicos) y su `id`
- [ ] Base de datos en estado limpio o con datos controlados para los casos de duplicados
- [ ] Cloudinary configurado (o stub local activo)

---

## 2. Registro de ticket — `POST /api/tickets`

### 2.1 Camino feliz — participante nuevo

**TC-REG-001** ✅  
**Descripción:** Registrar ticket completo con participante nuevo, un producto, sin multiplicador, sin bonus.

**Request:**
```json
{
  "cedula": "12345678",
  "nombre": "Juan Pérez",
  "celular": "04141234567",
  "ciudad": "Caracas",
  "email": "juan@email.com",
  "eventoId": 1,
  "numeroTicket": "TKT-001",
  "local": "Super 6 La Negrita",
  "multiplicador": false,
  "fotoBase64": "data:image/jpeg;base64,/9j/4AAQ...",
  "productos": [{ "sku": "1kg", "cantidad": 2 }]
}
```

**Resultado esperado:** `HTTP 201`
```json
{
  "mensaje": "Participante registrado y cupones asignados correctamente",
  "esUsuarioNuevo": true,
  "eventoId": 1,
  "numeroTicket": "TKT-001",
  "local": "Super 6 La Negrita",
  "multiplicadorAplicado": false,
  "coeficienteAplicado": 1,
  "fotoUrl": "<URL no vacía>",
  "productos": [{ "sku": "1kg", "cantidad": 2, "cuponesBase": 10, "coeficienteAplicado": 1, "cuponesGenerados": 10 }],
  "cuponesGenerados": 10,
  "bonus": null,
  "cuponesAcumulados": 10
}
```

**Verificar:** `esUsuarioNuevo: true`, cupones = 5 × 2 = 10, `bonus: null`, `fotoUrl` contiene URL válida.

---

### 2.2 Camino feliz — participante existente

**TC-REG-002** ✅  
**Descripción:** Registrar segundo ticket del mismo participante en la misma campaña. Nombre opcional.

**Request:** igual que TC-REG-001 pero con `numeroTicket: "TKT-002"` y sin campo `nombre`.

**Resultado esperado:** `HTTP 201`
- `esUsuarioNuevo: false`
- `mensaje: "Cupones agregados al participante existente"`
- `cuponesAcumulados` = 20 (acumula sobre los 10 anteriores)

---

### 2.3 Camino feliz — múltiples productos

**TC-REG-003** ✅  
**Descripción:** Ticket con varios SKUs en un solo registro.

**Productos:**
```json
[
  { "sku": "250g", "cantidad": 3 },
  { "sku": "500g", "cantidad": 2 },
  { "sku": "1kg",  "cantidad": 1 },
  { "sku": "5kg",  "cantidad": 1 }
]
```

**Resultado esperado:** `HTTP 201`
- `cuponesGenerados` = (2×3) + (3×2) + (5×1) + (15×1) = 6 + 6 + 5 + 15 = **32 cupones**
- `productos` contiene 4 elementos con sus respectivos `cuponesBase` y `cuponesGenerados`

---

### 2.4 Camino feliz — con multiplicador x2

**TC-REG-004** ✅  
**Descripción:** Local con multiplicador activo, coeficiente 2.

**Request:** `"multiplicador": true, "coeficienteMultiplicador": 2, "productos": [{ "sku": "1kg", "cantidad": 1 }]`

**Resultado esperado:** `HTTP 201`
- `cuponesBase` del producto = 5
- `cuponesGenerados` del producto = 10 (5 × 2)
- `multiplicadorAplicado: true`, `coeficienteAplicado: 2`

---

### 2.5 Camino feliz — con multiplicador x3

**TC-REG-005** ✅  
**Descripción:** Coeficiente 3 — verifica que el multiplicador escala correctamente.

**Request:** `"multiplicador": true, "coeficienteMultiplicador": 3, "productos": [{ "sku": "5kg", "cantidad": 2 }]`

**Resultado esperado:** `HTTP 201`
- `cuponesBase` = 30 (15 × 2)
- `cuponesGenerados` = 90 (30 × 3)

---

### 2.6 Camino feliz — con bonus

**TC-REG-006** ✅  
**Descripción:** Registro con bonus adicional de cupones.

**Request:** `"productos": [{ "sku": "1kg", "cantidad": 2 }], "bonus": 5, "multiplicador": false`

**Resultado esperado:** `HTTP 201`
- `cuponesGenerados`: 10 (solo productos)
- `bonus`: 5
- `cuponesAcumulados`: 15 (10 + 5)

---

### 2.7 Camino feliz — con multiplicador y bonus combinados

**TC-REG-007** ✅  
**Descripción:** El multiplicador aplica sobre productos; el bonus se suma al final sin multiplicar.

**Request:** `"multiplicador": true, "coeficienteMultiplicador": 2, "productos": [{ "sku": "1kg", "cantidad": 1 }], "bonus": 3`

**Resultado esperado:** `HTTP 201`
- Productos: `cuponesBase`=5, `cuponesGenerados`=10
- `cuponesGenerados` (total): 10
- `bonus`: 3
- `cuponesAcumulados`: 13

---

### 2.8 Camino feliz — coeficienteMultiplicador ≤ 0 se normaliza a 1

**TC-REG-008** ✅  
**Descripción:** Si `coeficienteMultiplicador` es 0 o negativo, debe normalizarse a 1 (sin efecto multiplicador).

**Request:** `"multiplicador": true, "coeficienteMultiplicador": 0, "productos": [{ "sku": "1kg", "cantidad": 1 }]`

**Resultado esperado:** `HTTP 201`
- `coeficienteAplicado`: 1
- `cuponesGenerados`: 5 (sin multiplicación)

---

### 2.9 Camino feliz — bonus = 0 (sin efecto)

**TC-REG-009** ✅  
**Descripción:** Enviar `bonus: 0` es válido y no modifica los cupones acumulados.

**Request:** `"bonus": 0, "productos": [{ "sku": "1kg", "cantidad": 1 }]`

**Resultado esperado:** `HTTP 201`
- `bonus`: 0
- `cuponesAcumulados` == `cuponesGenerados` (sin suma extra)

---

### 2.10 Validación — participante nuevo sin nombre

**TC-REG-010** ❌  
**Descripción:** Primera participación de una cédula sin incluir `nombre`.

**Request:** nueva cédula, sin campo `nombre`.

**Resultado esperado:** `HTTP 400`, `codigo: "USR_003"`

---

### 2.11 Validación — cédula con formato inválido

**TC-REG-011** ❌  
**Descripción:** Cédula con letras o con menos de 6 / más de 10 dígitos.

| Caso | `cedula` enviada |
|------|-----------------|
| Letras | `"ABC12345"` |
| Corta | `"12345"` |
| Larga | `"12345678901"` |

**Resultado esperado:** `HTTP 400` en todos los casos.

---

### 2.12 Validación — evento inexistente

**TC-REG-012** ❌  
**Descripción:** `eventoId` que no existe en la BD.

**Resultado esperado:** `HTTP 404`, `codigo: "EVT_001"`

---

### 2.13 Validación — evento inactivo

**TC-REG-013** ❌  
**Descripción:** `eventoId` con `activo=false`.

**Resultado esperado:** `HTTP 400`, `codigo: "EVT_002"`

---

### 2.14 Validación — evento no iniciado

**TC-REG-014** ❌  
**Descripción:** Evento con `fechaInicio` en el futuro.

**Resultado esperado:** `HTTP 400`, `codigo: "EVT_004"`, respuesta incluye campo `inicio` con la fecha.

---

### 2.15 Validación — evento vencido

**TC-REG-015** ❌  
**Descripción:** Evento con `fechaCierre` en el pasado.

**Resultado esperado:** `HTTP 400`, `codigo: "EVT_005"`, respuesta incluye campo `cierre` con la fecha.

---

### 2.16 Validación — evento cerrado manualmente

**TC-REG-016** ❌  
**Descripción:** Evento con estado `cerrado` (cerrado por operador antes de `fechaCierre`).

**Resultado esperado:** `HTTP 400`, `codigo: "EVT_003"`

---

### 2.17 Validación — SKU no válido para el evento

**TC-REG-017** ❌  
**Descripción:** Evento con `condicionesCupones` definidas. Enviar un SKU que no está en esas condiciones.

**Prerrequisito:** evento activo con `condicionesCupones: [{ sku: "1kg", cuponesPorUnidad: 5 }]`

**Request:** `"productos": [{ "sku": "5kg", "cantidad": 1 }]`

**Resultado esperado:** `HTTP 400`, `codigo: "FAC_003"`, respuesta incluye `skusInvalidos` y `skusValidos`.

---

### 2.18 Duplicado — mismo número de ticket en la misma campaña

**TC-REG-018** ❌  
**Descripción:** Intentar registrar un `numeroTicket` ya registrado para el mismo `eventoId`.

**Resultado esperado:** `HTTP 409`, `codigo: "FAC_001"`

---

### 2.19 Duplicado — imagen ya registrada (hash duplicado)

**TC-REG-019** ❌  
**Descripción:** Enviar exactamente la misma imagen base64 que ya fue registrada en el mismo evento (cuando `SECURITY_IMAGE_HASH_ENABLED=true`).

**Resultado esperado:** `HTTP 409`, `codigo: "IMG_004"`

---

### 2.20 Validación — fotoBase64 con formato inválido

**TC-REG-020** ❌  
**Descripción:** Imagen sin prefijo `data:image/...;base64,` o con tipo MIME no permitido.

| Caso | Valor enviado |
|------|---------------|
| Sin prefijo | `"/9j/4AAQ..."` |
| GIF | `"data:image/gif;base64,R0lGOD..."` |
| Vacío | `""` |

**Resultado esperado:** `HTTP 400` en todos los casos.

---

### 2.21 Validación — productos vacíos

**TC-REG-021** ❌  
**Descripción:** Array `productos` vacío.

**Request:** `"productos": []`

**Resultado esperado:** `HTTP 400`

---

### 2.22 Validación — SKU no reconocido en catálogo global

**TC-REG-022** ❌  
**Descripción:** SKU que no existe en el catálogo `["250g", "500g", "1kg", "5kg"]`.

**Request:** `"productos": [{ "sku": "2kg", "cantidad": 1 }]`

**Resultado esperado:** `HTTP 400`

---

### 2.23 Validación — cantidad fuera de rango

**TC-REG-023** ❌  
**Descripción:** Cantidad de producto ≤ 0 o > 1000.

| Caso | cantidad |
|------|---------|
| Cero | `0` |
| Negativo | `-1` |
| Excesivo | `1001` |

**Resultado esperado:** `HTTP 400` en todos los casos.

---

### 2.24 Validación — multiplicador=true sin coeficiente

**TC-REG-024** ❌  
**Descripción:** `multiplicador: true` pero sin enviar `coeficienteMultiplicador`.

**Resultado esperado:** `HTTP 400`

---

### 2.25 Validación — bonus negativo

**TC-REG-025** ❌  
**Descripción:** `bonus: -1`

**Resultado esperado:** `HTTP 400`

---

### 2.26 Fallo de infraestructura — Cloudinary no disponible → guarda pendiente

**TC-REG-026** ❌ (503 esperado)  
**Descripción:** Simular fallo en Cloudinary (desactivar credenciales o usar entorno de prueba).

**Resultado esperado:** `HTTP 503`, `codigo: "FAC_007"`, respuesta incluye `pendienteId`.  
**Verificar:** existe registro en `tickets_pendientes` con `estado=pendiente`, `etapa_error=upload_imagen`, `foto_buffer_b64` no nulo.

---

### 2.27 Fallo de infraestructura — escritura DB falla → guarda pendiente con fotoUrl

**TC-REG-027** ❌ (503 esperado)  
**Descripción:** Forzar fallo de escritura (`FORCE_DB_WRITE_ERROR=true`). La imagen ya fue subida.

**Resultado esperado:** `HTTP 503`, `codigo: "FAC_008"`, respuesta incluye `pendienteId`.  
**Verificar:** registro en `tickets_pendientes` con `estado=pendiente`, `etapa_error=escritura_db`, `foto_url` no nulo, `foto_buffer_b64` nulo.

---

## 3. Listado general de tickets — `GET /api/tickets`

### 3.1 Listado sin filtros

**TC-LIST-001** ✅  
**Descripción:** Obtener todos los tickets paginados.

**Request:** `GET /api/tickets`

**Resultado esperado:** `HTTP 200`
```json
{
  "data": [ { "id": ..., "ciudad": ..., "eventoId": ..., "eventoNombre": ..., "numeroTicket": ..., "sku": ..., ... } ],
  "total": <número>,
  "page": 1,
  "limit": 20
}
```
**Verificar:** no aparecen campos PII (`cedula`, `nombre`, `celular`, `email`).

---

### 3.2 Filtro por número de ticket (parcial, case-insensitive)

**TC-LIST-002** ✅  
**Descripción:** Filtrar por `numeroTicket` parcial.

**Request:** `GET /api/tickets?numeroTicket=TKT`

**Resultado esperado:** `HTTP 200`, todos los items en `data` contienen `"TKT"` en su `numeroTicket`.

---

### 3.3 Filtro por ciudad (parcial, case-insensitive)

**TC-LIST-003** ✅  
**Request:** `GET /api/tickets?ciudad=cara`

**Resultado esperado:** `HTTP 200`, todos los items tienen `ciudad` que contiene `"cara"` (sin importar mayúsculas).

---

### 3.4 Filtro por rango de fechas

**TC-LIST-004** ✅  
**Request:** `GET /api/tickets?fechaDesde=2025-01-01&fechaHasta=2025-12-31`

**Resultado esperado:** `HTTP 200`, todos los `fechaCarga` caen dentro del rango. El límite `fechaHasta` incluye hasta las 23:59:59.999 del día indicado.

---

### 3.5 Paginación

**TC-LIST-005** ✅  
**Request:** `GET /api/tickets?page=2&limit=5`

**Resultado esperado:** `HTTP 200`, `data` tiene máximo 5 elementos, `page: 2`, `limit: 5`.

---

### 3.6 Campo bonus visible en listado

**TC-LIST-006** ✅  
**Descripción:** Verificar que el campo `bonus` aparece en los tickets que lo tienen (primera fila del registro), y es `null` en las demás filas del mismo ticket con múltiples productos.

**Resultado esperado:** `HTTP 200`, `bonus` es un número en la primera fila y `null` en las siguientes del mismo `numeroTicket`.

---

## 4. Consulta de cupones por participante — `GET /api/tickets/:cedula/cupones`

### 4.1 Participante con participaciones en múltiples campañas

**TC-CUP-001** ✅  
**Request:** `GET /api/tickets/12345678/cupones`

**Resultado esperado:** `HTTP 200`
```json
{
  "campanhas": [
    {
      "eventoId": 1,
      "nombre": "Campaña Verano 2025",
      "cuponesAcumulados": 45,
      "facturas": [ { "id": ..., "numeroTicket": ..., "sku": ..., "cuponesGenerados": ..., ... } ]
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```
**Verificar:** `cuponesAcumulados` coincide con la suma de todos los tickets + bonuses de esa campaña.

---

### 4.2 Participante con bonus en sus cupones

**TC-CUP-002** ✅  
**Descripción:** Verificar que las facturas con bonus muestran el campo `bonus` correctamente.

**Resultado esperado:** `HTTP 200`, en `facturas[]` el elemento con bonus tiene `bonus: <número>`, los demás tienen `bonus: null`.

---

### 4.3 Paginación de campañas

**TC-CUP-003** ✅  
**Request:** `GET /api/tickets/12345678/cupones?page=1&limit=1`

**Resultado esperado:** `HTTP 200`, `campanhas` tiene 1 elemento, `total` refleja el total real de campañas.

---

### 4.4 Participante no encontrado

**TC-CUP-004** ❌  
**Request:** `GET /api/tickets/99999999/cupones`

**Resultado esperado:** `HTTP 404`, `codigo: "USR_001"`

---

### 4.5 Cédula con formato inválido

**TC-CUP-005** ❌  
**Request:** `GET /api/tickets/ABC/cupones`

**Resultado esperado:** `HTTP 400` (validación de ruta o 404 según implementación).

---

## 5. Consulta por participante y evento — `GET /api/tickets/:cedula/evento/:eventoId`

### 5.1 Participante con tickets en el evento

**TC-EVT-001** ✅  
**Request:** `GET /api/tickets/12345678/evento/1`

**Resultado esperado:** `HTTP 200`
```json
{
  "eventoId": 1,
  "cuponesAcumulados": 45,
  "totalFacturas": 3,
  "facturas": [ { "id": ..., "numeroTicket": ..., ... } ],
  "page": 1,
  "limit": 20
}
```

---

### 5.2 Participante que no está en ese evento

**TC-EVT-002** ✅  
**Descripción:** Participante existente pero sin participación en el evento indicado.

**Resultado esperado:** `HTTP 200`
```json
{
  "eventoId": <id>,
  "cuponesAcumulados": 0,
  "totalFacturas": 0,
  "facturas": [],
  "page": 1,
  "limit": 20
}
```

---

### 5.3 Participante no encontrado

**TC-EVT-003** ❌  
**Request:** `GET /api/tickets/99999999/evento/1`

**Resultado esperado:** `HTTP 404`, `codigo: "USR_001"`

---

### 5.4 Paginación de facturas

**TC-EVT-004** ✅  
**Request:** `GET /api/tickets/12345678/evento/1?page=1&limit=2`

**Resultado esperado:** `HTTP 200`, `facturas` tiene máximo 2 elementos, `totalFacturas` refleja el total real.

---

### 5.5 eventoId inválido (no numérico)

**TC-EVT-005** ❌  
**Request:** `GET /api/tickets/12345678/evento/abc`

**Resultado esperado:** `HTTP 400` (fallo ParseIntPipe).

---

## 6. Consulta de participantes

### 6.1 Listar participantes paginados

**TC-PART-001** ✅  
**Request:** `GET /api/participantes?page=1&limit=10`

**Resultado esperado:** `HTTP 200`
```json
{
  "data": [ { "ciudad": "Caracas" }, ... ],
  "total": <número>,
  "page": 1,
  "limit": 10
}
```
**Verificar:** no aparece `cedula`, `nombre`, `celular` ni `email` en ningún elemento.

---

### 6.2 Obtener participante por cédula

**TC-PART-002** ✅  
**Request:** `GET /api/participantes/12345678`

**Resultado esperado:** `HTTP 200`, respuesta contiene solo `ciudad`, no expone PII.

---

### 6.3 Participante no encontrado

**TC-PART-003** ❌  
**Request:** `GET /api/participantes/99999999`

**Resultado esperado:** `HTTP 404`, `codigo: "USR_001"`

---

### 6.4 Actualizar ciudad del participante

**TC-PART-004** ✅  
**Request:** `PATCH /api/participantes/12345678` con body `{ "ciudad": "Maracaibo" }`

**Resultado esperado:** `HTTP 200`, `ciudad: "Maracaibo"`.  
**Verificar:** consulta posterior `GET /api/participantes/12345678` devuelve la ciudad actualizada.

---

### 6.5 Actualizar participante inexistente

**TC-PART-005** ❌  
**Request:** `PATCH /api/participantes/99999999` con body `{ "ciudad": "Valencia" }`

**Resultado esperado:** `HTTP 404`, `codigo: "USR_001"`

---

## 7. Consulta de pendientes — `GET /api/tickets/pendientes`

### 7.1 Listado sin filtros

**TC-PEND-001** ✅  
**Request:** `GET /api/tickets/pendientes`

**Resultado esperado:** `HTTP 200`
```json
{
  "data": [
    {
      "id": 1,
      "cedula": "12345678",
      "eventoId": 1,
      "numeroTicket": "TKT-001",
      "estado": "pendiente",
      "etapaError": "upload_imagen",
      "mensajeError": "...",
      "intentos": 0,
      "tieneImagen": true,
      "fechaRegistro": "...",
      "fechaUltimoIntento": null
    }
  ],
  "total": <número>,
  "page": 1,
  "limit": 20
}
```

---

### 7.2 Filtro por estado `pendiente`

**TC-PEND-002** ✅  
**Request:** `GET /api/tickets/pendientes?estado=pendiente`

**Resultado esperado:** `HTTP 200`, todos los elementos tienen `estado: "pendiente"`.

---

### 7.3 Filtro por estado `completado`

**TC-PEND-003** ✅  
**Request:** `GET /api/tickets/pendientes?estado=completado`

**Resultado esperado:** `HTTP 200`, todos los elementos tienen `estado: "completado"`.

---

### 7.4 Filtro por estado `fallido_permanente`

**TC-PEND-004** ✅  
**Request:** `GET /api/tickets/pendientes?estado=fallido_permanente`

**Resultado esperado:** `HTTP 200`, todos los elementos tienen `estado: "fallido_permanente"`.

---

### 7.5 Filtro por cédula

**TC-PEND-005** ✅  
**Request:** `GET /api/tickets/pendientes?cedula=12345678`

**Resultado esperado:** `HTTP 200`, todos los elementos tienen `cedula: "12345678"`.

---

### 7.6 Filtro por eventoId

**TC-PEND-006** ✅  
**Request:** `GET /api/tickets/pendientes?eventoId=1`

**Resultado esperado:** `HTTP 200`, todos los elementos tienen `eventoId: 1`.

---

### 7.7 Filtro combinado: estado + cédula

**TC-PEND-007** ✅  
**Request:** `GET /api/tickets/pendientes?estado=pendiente&cedula=12345678`

**Resultado esperado:** `HTTP 200`, todos coinciden con ambos filtros.

---

### 7.8 Estado inválido

**TC-PEND-008** ❌  
**Request:** `GET /api/tickets/pendientes?estado=invalido`

**Resultado esperado:** `HTTP 400`

---

### 7.9 Campo `tieneImagen` refleja correctamente la disponibilidad

**TC-PEND-009** ✅  
**Descripción:** Un pendiente con `etapaError=upload_imagen` debe tener `tieneImagen: true` (tiene buffer). Un pendiente con imagen ya subida (`etapaError=escritura_db`) también debe tener `tieneImagen: true` (tiene fotoUrl).

**Resultado esperado:** `HTTP 200`, `tieneImagen` es `true` en ambos casos.

---

## 8. Reintento unitario — `POST /api/tickets/pendientes/:id/reintentar`

### 8.1 Reintento exitoso — pendiente con buffer de imagen (fallo en upload)

**TC-REIN-001** ✅  
**Prerrequisito:** pendiente en estado `pendiente` con `etapa_error=upload_imagen` y `foto_buffer_b64` no nulo.

**Request:** `POST /api/tickets/pendientes/1/reintentar`

**Resultado esperado:** `HTTP 200`
```json
{
  "pendienteId": 1,
  "exitoso": true,
  "mensaje": "Reintento exitoso. Ticket registrado correctamente.",
  "registro": { "eventoId": ..., "numeroTicket": ..., "cuponesGenerados": ..., ... }
}
```
**Verificar:** 
- El registro ahora aparece en `tickets` (tabla principal).
- El pendiente tiene `estado=completado`.
- `foto_buffer_b64` fue limpiado (null) y `foto_url` fue seteado.

---

### 8.2 Reintento exitoso — pendiente con fotoUrl (fallo en escritura DB)

**TC-REIN-002** ✅  
**Prerrequisito:** pendiente con `etapa_error=escritura_db` y `foto_url` ya disponible.

**Request:** `POST /api/tickets/pendientes/2/reintentar`

**Resultado esperado:** `HTTP 200`, `exitoso: true`.  
**Verificar:** no se re-sube la imagen (fotoUrl ya existía), el ticket queda en DB.

---

### 8.3 Reintento exitoso — conserva bonus del formulario original

**TC-REIN-003** ✅  
**Prerrequisito:** pendiente originado de un registro con `bonus: 5`.

**Resultado esperado:** `HTTP 200`, `registro.bonus: 5` y `registro.cuponesAcumulados` incluye el bonus.

---

### 8.4 Pendiente no encontrado

**TC-REIN-004** ❌  
**Request:** `POST /api/tickets/pendientes/99999/reintentar`

**Resultado esperado:** `HTTP 404`, `codigo: "FAC_004"`

---

### 8.5 Pendiente ya completado

**TC-REIN-005** ❌  
**Prerrequisito:** pendiente con `estado=completado`.

**Request:** `POST /api/tickets/pendientes/<id>/reintentar`

**Resultado esperado:** `HTTP 400`, `codigo: "FAC_005"`

---

### 8.6 Pendiente en estado procesando

**TC-REIN-006** ❌  
**Prerrequisito:** pendiente con `estado=procesando` (si es posible forzar este estado manualmente en la BD para la prueba).

**Resultado esperado:** `HTTP 400`, `codigo: "FAC_006"`

---

### 8.7 Reintento falla — evento ya no válido (expiró desde que se creó el pendiente)

**TC-REIN-007** ❌  
**Prerrequisito:** pendiente de un evento cuya fecha de cierre ya pasó.

**Request:** `POST /api/tickets/pendientes/<id>/reintentar`

**Resultado esperado:** `HTTP 422` (UNPROCESSABLE_ENTITY), `etapaFallo: "validacion"`, mensaje describe el fallo.  
**Verificar:** el estado del pendiente sigue siendo `pendiente` (no completado), `intentos` incrementado en 1.

---

### 8.8 Reintento falla — imagen no disponible (sin buffer ni URL)

**TC-REIN-008** ❌  
**Prerrequisito:** pendiente con `foto_buffer_b64=null` y `foto_url=null` (estado corrupto o manual).

**Resultado esperado:** `HTTP 422`, `etapaFallo: "imagen_no_disponible"`, `codigo: "IMG_005"`.

---

### 8.9 Escalada a `fallido_permanente` tras 5 intentos

**TC-REIN-009** ❌  
**Descripción:** Forzar que el reintento falle 5 veces consecutivas (p.ej., evento expirado).

**Resultado esperado:** Tras el 5° intento fallido, el pendiente pasa a `estado=fallido_permanente`.  
**Verificar:** la respuesta contiene `"Máximo de intentos alcanzado (5). Requiere intervención manual."`.

---

### 8.10 id inválido (no numérico)

**TC-REIN-010** ❌  
**Request:** `POST /api/tickets/pendientes/abc/reintentar`

**Resultado esperado:** `HTTP 400` (fallo ParseIntPipe).

---

## 9. Reintento masivo — `POST /api/tickets/pendientes/reintentar-todos`

### 9.1 Sin pendientes en estado `pendiente`

**TC-MASS-001** ✅  
**Prerrequisito:** no hay registros con `estado=pendiente`.

**Request:** `POST /api/tickets/pendientes/reintentar-todos`

**Resultado esperado:** `HTTP 200`
```json
{
  "procesados": 0,
  "exitosos": 0,
  "fallidos": 0,
  "resultados": []
}
```

---

### 9.2 Todos los pendientes se procesan exitosamente

**TC-MASS-002** ✅  
**Prerrequisito:** 3 pendientes en estado `pendiente` con datos válidos y Cloudinary disponible.

**Request:** `POST /api/tickets/pendientes/reintentar-todos`

**Resultado esperado:** `HTTP 200`
- `procesados: 3`, `exitosos: 3`, `fallidos: 0`
- Cada elemento en `resultados` tiene `exitoso: true`
- Los 3 registros ahora existen en `tickets` y tienen `estado=completado` en `tickets_pendientes`

---

### 9.3 Mezcla de éxitos y fallos

**TC-MASS-003** ✅  
**Prerrequisito:** 2 pendientes válidos + 1 pendiente con evento ya expirado.

**Request:** `POST /api/tickets/pendientes/reintentar-todos`

**Resultado esperado:** `HTTP 200`
- `procesados: 3`, `exitosos: 2`, `fallidos: 1`
- El fallido tiene `exitoso: false` y `etapaFallo: "validacion"`

---

### 9.4 Solo procesa estado `pendiente`, ignora `completado` y `fallido_permanente`

**TC-MASS-004** ✅  
**Prerrequisito:** 1 pendiente en `pendiente`, 1 en `completado`, 1 en `fallido_permanente`.

**Request:** `POST /api/tickets/pendientes/reintentar-todos`

**Resultado esperado:** `HTTP 200`, `procesados: 1` (solo el que estaba en `pendiente`).

---

### 9.5 Estructura del resumen con detalle por ticket

**TC-MASS-005** ✅  
**Descripción:** Verificar que `resultados[]` contiene `pendienteId` en cada elemento.

**Resultado esperado:** `HTTP 200`, cada elemento de `resultados` tiene `pendienteId` y `exitoso`.

---

### 9.6 El reintento masivo conserva el bonus de cada pendiente

**TC-MASS-006** ✅  
**Prerrequisito:** pendiente guardado originalmente con `bonus: 3`.

**Request:** `POST /api/tickets/pendientes/reintentar-todos`

**Resultado esperado:** `HTTP 200`, el ticket resultante en la BD tiene el bonus aplicado correctamente en `cupones_acumulados`.

---

## 10. Seguridad y autenticación

### 10.1 Request sin API Key

**TC-SEC-001** ❌  
**Descripción:** Cualquier endpoint sin header `x-api-key`.

**Resultado esperado:** `HTTP 401`, `codigo: "AUTH_001"`

---

### 10.2 API Key inválida

**TC-SEC-002** ❌  
**Request:** `x-api-key: clave_incorrecta`

**Resultado esperado:** `HTTP 401`, `codigo: "AUTH_003"`

---

### 10.3 `POST /api/tickets` sin firma HMAC

**TC-SEC-003** ❌  
**Descripción:** API Key válida pero sin headers `x-hmac-signature` / `x-hmac-timestamp`.

**Resultado esperado:** `HTTP 401`, `codigo: "AUTH_004"`

---

### 10.4 HMAC con timestamp expirado

**TC-SEC-004** ❌  
**Descripción:** Header `x-hmac-timestamp` con valor de hace más de los segundos permitidos por la ventana de tiempo.

**Resultado esperado:** `HTTP 401`, `codigo: "AUTH_005"`

---

### 10.5 HMAC con firma incorrecta

**TC-SEC-005** ❌  
**Descripción:** Timestamp válido pero firma calculada con clave incorrecta.

**Resultado esperado:** `HTTP 401`, `codigo: "AUTH_006"`

---

### 10.6 `GET /api/health` no requiere autenticación

**TC-SEC-006** ✅  
**Request:** `GET /api/health` sin ningún header de auth.

**Resultado esperado:** `HTTP 200` (endpoint público).

---

### 10.7 Respuestas no exponen PII

**TC-SEC-007** ✅  
**Descripción:** Verificar en cada endpoint que los campos `cedula`, `nombre`, `celular` y `email` nunca aparecen en el response body.

| Endpoint | Verificar ausencia de PII |
|----------|--------------------------|
| `POST /api/tickets` | ✅ |
| `GET /api/tickets` | ✅ |
| `GET /api/tickets/:cedula/cupones` | ✅ |
| `GET /api/tickets/:cedula/evento/:id` | ✅ |
| `GET /api/participantes` | ✅ (solo `ciudad`) |
| `GET /api/participantes/:cedula` | ✅ (solo `ciudad`) |
| `GET /api/tickets/pendientes` | ✅ (cedula visible solo en el campo funcional de pendientes — aceptable para uso interno) |

---

## Apéndice A — Tabla de cálculo de cupones

| SKU | Cupones/unidad | Ejemplo: 3 unidades | Con coeficiente x2 |
|-----|---------------|---------------------|--------------------|
| 250g | 2 | 6 | 12 |
| 500g | 3 | 9 | 18 |
| 1kg | 5 | 15 | 30 |
| 5kg | 15 | 45 | 90 |

---

## Apéndice B — Códigos de error de referencia

| Código | Significado |
|--------|-------------|
| `AUTH_001` | API Key ausente |
| `AUTH_002` | Formato de auth inválido |
| `AUTH_003` | API Key incorrecta |
| `AUTH_004` | HMAC ausente |
| `AUTH_005` | HMAC expirado |
| `AUTH_006` | HMAC inválido |
| `EVT_001` | Evento no encontrado |
| `EVT_002` | Evento inactivo |
| `EVT_003` | Evento cerrado manualmente |
| `EVT_004` | Evento no iniciado |
| `EVT_005` | Evento vencido |
| `FAC_001` | Ticket duplicado en campaña |
| `FAC_003` | SKU inválido para el evento |
| `FAC_004` | Pendiente no encontrado |
| `FAC_005` | Pendiente ya procesado |
| `FAC_006` | Pendiente en estado procesando |
| `FAC_007` | Fallo upload imagen (503) |
| `FAC_008` | Fallo persistencia DB (503) |
| `IMG_004` | Imagen duplicada (hash) |
| `IMG_005` | Imagen no disponible en reintento |
| `USR_001` | Participante no encontrado |
| `USR_003` | Nombre requerido (primer registro) |
| `VAL_001` | Error de validación de DTO |
