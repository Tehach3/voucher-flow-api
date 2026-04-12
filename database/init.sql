-- ============================================================================
-- INICIALIZACIÓN DE BASE DE DATOS - PLATAFORMA DE SORTEOS / VOUCHER FLOW
-- ============================================================================
-- Descripción: Script SQL para crear tablas, índices, constraints y data inicial
-- Soporta múltiples campañas con validación de cupones por campaña
-- Base de datos: voucher-flow-db
-- Versión: 2.0
-- ============================================================================

-- ============================================================================
-- 1. CREAR EXTENSIONES NECESARIAS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- ============================================================================
-- 2. CREAR TABLA: EVENTOS (campañas)
-- ============================================================================

CREATE TABLE IF NOT EXISTS eventos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,

  -- Estado interno: solo se escribe 'abierto' (por defecto) o 'cerrado' (cierre manual).
  -- El estado visible en la API se calcula dinámicamente:
  --   'no_iniciado' → now < fecha_inicio
  --   'vigente'     → fecha_inicio <= now <= fecha_vencimiento
  --   'vencido'     → now > fecha_vencimiento
  --   'cerrado'     → estado = 'cerrado' (cierre manual)
  estado VARCHAR(20) NOT NULL DEFAULT 'abierto'
    CHECK (estado IN ('abierto', 'cerrado')),

  fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  fecha_vencimiento TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Garantiza que el cierre sea siempre posterior al inicio
  CONSTRAINT chk_fechas_evento CHECK (fecha_vencimiento > fecha_inicio),

  require_validacion_cupones BOOLEAN NOT NULL DEFAULT TRUE,
  cupones_minimos INTEGER NOT NULL DEFAULT 1 CHECK (cupones_minimos >= 1),
  tiene_condiciones_multiples BOOLEAN NOT NULL DEFAULT FALSE,
  condiciones_cupones JSONB,
  premios JSONB,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_registro TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  imagen_url VARCHAR(500)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_eventos_nombre ON eventos(nombre) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_eventos_estado ON eventos(estado);
CREATE INDEX IF NOT EXISTS idx_eventos_activo ON eventos(activo);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha_vencimiento ON eventos(fecha_vencimiento DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha_inicio ON eventos(fecha_inicio DESC);

COMMENT ON TABLE eventos IS 'Campañas de sorteo/promociones';
COMMENT ON COLUMN eventos.estado IS 'Estado interno: abierto (por defecto) | cerrado (manual). El estado visible en la API es calculado: no_iniciado | vigente | vencido | cerrado';
COMMENT ON COLUMN eventos.fecha_inicio IS 'Fecha desde la cual la campaña acepta participaciones';
COMMENT ON COLUMN eventos.fecha_vencimiento IS 'Fecha de cierre de la campaña (límite para participar). Debe ser futura al momento de crear o actualizar el evento.';
COMMENT ON COLUMN eventos.require_validacion_cupones IS 'Siempre TRUE: se valida cupones_minimos para toda participación';
COMMENT ON COLUMN eventos.cupones_minimos IS 'Mínimo de cupones requeridos para participar (obligatorio, mínimo 1)';
COMMENT ON COLUMN eventos.tiene_condiciones_multiples IS 'true = múltiples condiciones por SKU (2+ entradas). false = única condición (0 o 1 entrada, genera bajo la misma regla).';
COMMENT ON COLUMN eventos.condiciones_cupones IS 'Array JSONB de condiciones: [{sku, cuponesPorUnidad}]. Ej: [{"sku":"5kg","cuponesPorUnidad":15}]. Fuente única de SKUs válidos.';
COMMENT ON COLUMN eventos.premios IS 'Array JSONB de premios: [{descripcion, orden}]. Permite múltiples premios por campaña.';


-- ============================================================================
-- 3. CREAR TABLA: USUARIOS (participantes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  cedula VARCHAR(10) NOT NULL UNIQUE,
  nombre VARCHAR(255) NOT NULL,
  celular VARCHAR(20),
  ciudad VARCHAR(100),
  email VARCHAR(255),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_registro TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_cedula ON usuarios(cedula);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_fecha_registro ON usuarios(fecha_registro DESC);

COMMENT ON TABLE usuarios IS 'Participantes registrados en campañas';
COMMENT ON COLUMN usuarios.cedula IS 'Cédula única del participante (6-10 dígitos)';


-- ============================================================================
-- 4. CREAR TABLA: PARTICIPACIONES POR CAMPAÑA
-- ============================================================================

CREATE TABLE IF NOT EXISTS participaciones_evento (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  cupones_acumulados INTEGER NOT NULL DEFAULT 0 CHECK (cupones_acumulados >= 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_registro TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(usuario_id, evento_id)
);

CREATE INDEX IF NOT EXISTS idx_participaciones_usuario_id ON participaciones_evento(usuario_id);
CREATE INDEX IF NOT EXISTS idx_participaciones_evento_id ON participaciones_evento(evento_id);
CREATE INDEX IF NOT EXISTS idx_participaciones_usuario_evento ON participaciones_evento(usuario_id, evento_id);
CREATE INDEX IF NOT EXISTS idx_participaciones_cupones ON participaciones_evento(cupones_acumulados DESC);
CREATE INDEX IF NOT EXISTS idx_participaciones_activo ON participaciones_evento(activo);
CREATE INDEX IF NOT EXISTS idx_participaciones_evento_estado ON participaciones_evento(evento_id, activo);

COMMENT ON TABLE participaciones_evento IS 'Participación de un usuario en una campaña con sus cupones acumulados';


-- ============================================================================
-- 5. CREAR TABLA: TICKETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  participacion_id INTEGER NOT NULL REFERENCES participaciones_evento(id) ON DELETE CASCADE,
  numero_ticket VARCHAR(50) NOT NULL,

  -- Establecimiento donde se realizó la compra
  local VARCHAR(255) NOT NULL,

  -- Multiplicador de puntos del local
  multiplicador BOOLEAN NOT NULL DEFAULT FALSE,
  coeficiente_multiplicador INTEGER
    CHECK (coeficiente_multiplicador IS NULL OR coeficiente_multiplicador >= 2),
  -- Si multiplicador=true, coeficiente_multiplicador debe estar presente
  CONSTRAINT chk_multiplicador_coeficiente
    CHECK (multiplicador = FALSE OR coeficiente_multiplicador IS NOT NULL),

  sku VARCHAR(10) NOT NULL CHECK (sku IN ('250g', '500g', '1kg', '5kg')),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),

  -- Cupones antes de aplicar el multiplicador del local
  cupones_base INTEGER NOT NULL CHECK (cupones_base >= 0),
  -- Cupones finales = cupones_base × coeficiente_multiplicador (o cupones_base si no hay multiplicador)
  cupones_generados INTEGER NOT NULL CHECK (cupones_generados >= 0),

  foto_url VARCHAR(500) NOT NULL,
  ocr_data JSONB,
  fecha_carga TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(evento_id, usuario_id, numero_ticket, sku)
);

CREATE INDEX IF NOT EXISTS idx_tickets_usuario_id ON tickets(usuario_id);
CREATE INDEX IF NOT EXISTS idx_tickets_evento_id ON tickets(evento_id);
CREATE INDEX IF NOT EXISTS idx_tickets_participacion_id ON tickets(participacion_id);
CREATE INDEX IF NOT EXISTS idx_tickets_numero_ticket ON tickets(numero_ticket);
CREATE INDEX IF NOT EXISTS idx_tickets_sku ON tickets(sku);
CREATE INDEX IF NOT EXISTS idx_tickets_fecha_carga ON tickets(fecha_carga DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_activo ON tickets(activo);
CREATE INDEX IF NOT EXISTS idx_tickets_usuario_evento_fecha ON tickets(usuario_id, evento_id, fecha_carga DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_evento_usuario ON tickets(evento_id, usuario_id);

COMMENT ON TABLE tickets IS 'Tickets/vouchers cargados por participantes en campañas (facturas, recibos, comprobantes)';
COMMENT ON COLUMN tickets.numero_ticket IS 'Número del ticket, factura o comprobante presentado';
COMMENT ON COLUMN tickets.evento_id IS 'ID de la campaña a la cual pertenece el ticket';
COMMENT ON COLUMN tickets.participacion_id IS 'ID de la participación del usuario en la campaña';
COMMENT ON COLUMN tickets.local IS 'Nombre del local o establecimiento donde se realizó la compra (ej: Super 6 La Negrita)';
COMMENT ON COLUMN tickets.multiplicador IS 'true si el local aplica multiplicador de cupones';
COMMENT ON COLUMN tickets.coeficiente_multiplicador IS 'Factor de multiplicación (2=x2, 3=x3, etc.). NULL si multiplicador=false';
COMMENT ON COLUMN tickets.cupones_base IS 'Cupones calculados antes de aplicar el multiplicador del local';
COMMENT ON COLUMN tickets.cupones_generados IS 'Cupones finales = cupones_base × coeficiente_multiplicador (o cupones_base si no hay multiplicador)';


-- ============================================================================
-- 6. CREAR TABLA: TICKETS_PENDIENTES (reintentos por fallo de escritura DB)
-- ============================================================================
-- Flujo actual: el cliente sube la imagen a /api/imagenes/upload y recibe la URL.
-- Luego llama a /api/tickets con JSON incluyendo fotoUrl.
-- Si la escritura en DB falla, se guarda un pendiente con todos los datos + fotoUrl
-- para reintentarlo manual o automáticamente sin perder información.

CREATE TABLE IF NOT EXISTS tickets_pendientes (
  id SERIAL PRIMARY KEY,

  -- Snapshot del formulario completo incluyendo fotoUrl ya subida.
  -- Estructura: {cedula, nombre?, celular?, ciudad?, email?, eventoId, numeroTicket, fotoUrl, productos}
  datos_formulario JSONB NOT NULL,

  -- Copia directa de fotoUrl para facilitar consultas sin parsear el JSONB.
  foto_url VARCHAR(500),

  -- Campos legacy — se mantienen para compatibilidad con registros anteriores al flujo JSON.
  -- En registros nuevos siempre serán NULL.
  foto_buffer_b64 TEXT,
  foto_mimetype VARCHAR(50),

  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'procesando', 'completado', 'fallido_permanente')),

  -- Etapa donde ocurrió el fallo.
  -- 'escritura_db' es el único valor generado por el flujo actual.
  -- 'upload_imagen' se mantiene por compatibilidad con registros anteriores.
  etapa_error VARCHAR(20) NOT NULL
    CHECK (etapa_error IN ('upload_imagen', 'escritura_db')),

  mensaje_error TEXT,
  intentos INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),

  fecha_registro TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_ultimo_intento TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_pendientes_estado ON tickets_pendientes(estado);
CREATE INDEX IF NOT EXISTS idx_pendientes_estado_fecha ON tickets_pendientes(estado, fecha_registro ASC);
CREATE INDEX IF NOT EXISTS idx_pendientes_cedula ON tickets_pendientes((datos_formulario->>'cedula'));
CREATE INDEX IF NOT EXISTS idx_pendientes_evento ON tickets_pendientes(((datos_formulario->>'eventoId')::int));

COMMENT ON TABLE tickets_pendientes IS 'Tickets cuya escritura en DB falló. Se guardan para reintento manual o automático.';
COMMENT ON COLUMN tickets_pendientes.datos_formulario IS 'Snapshot del formulario: {cedula, nombre, celular, ciudad, email, eventoId, numeroTicket, fotoUrl, productos}';
COMMENT ON COLUMN tickets_pendientes.foto_url IS 'URL de la imagen ya subida a Cloudinary (copia de datos_formulario.fotoUrl para consultas directas).';
COMMENT ON COLUMN tickets_pendientes.foto_buffer_b64 IS 'Legacy: imagen en base64. NULL en registros nuevos.';
COMMENT ON COLUMN tickets_pendientes.estado IS 'pendiente=espera reintento | procesando=en proceso | completado=OK | fallido_permanente=superó max intentos';
COMMENT ON COLUMN tickets_pendientes.etapa_error IS 'escritura_db=transacción DB falló (flujo actual) | upload_imagen=legacy';


-- ============================================================================
-- 7. CREAR TABLA: AUDITORIA
-- ============================================================================

CREATE TABLE IF NOT EXISTS auditoria (
  id SERIAL PRIMARY KEY,
  evento_tipo VARCHAR(50) NOT NULL,
  entidad VARCHAR(50) NOT NULL,
  entidad_id INTEGER,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  fecha_evento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auditoria_evento ON auditoria(evento_tipo);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria(entidad, entidad_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha_evento DESC);


-- ============================================================================
-- 7. FUNCIÓN: TRIGGER PARA ACTUALIZAR fecha_actualizacion
-- ============================================================================

CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_eventos_actualizar_fecha ON eventos;
CREATE TRIGGER trigger_eventos_actualizar_fecha
BEFORE UPDATE ON eventos
FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_usuarios_actualizar_fecha ON usuarios;
CREATE TRIGGER trigger_usuarios_actualizar_fecha
BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_participaciones_actualizar_fecha ON participaciones_evento;
CREATE TRIGGER trigger_participaciones_actualizar_fecha
BEFORE UPDATE ON participaciones_evento
FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_actualizacion();


-- ============================================================================
-- 8. FUNCIÓN: ACTUALIZAR CUPONES EN PARTICIPACIÓN (trigger on INSERT ticket)
-- ============================================================================

CREATE OR REPLACE FUNCTION actualizar_cupones_participacion()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE participaciones_evento
  SET cupones_acumulados = cupones_acumulados + NEW.cupones_generados
  WHERE id = NEW.participacion_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tickets_actualizar_cupones ON tickets;
CREATE TRIGGER trigger_tickets_actualizar_cupones
AFTER INSERT ON tickets
FOR EACH ROW EXECUTE FUNCTION actualizar_cupones_participacion();


-- ============================================================================
-- 9. FUNCIÓN: AUDITORIA (trigger)
-- ============================================================================

CREATE OR REPLACE FUNCTION registrar_auditoria()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO auditoria (evento_tipo, entidad, entidad_id, datos_anteriores, datos_nuevos)
  VALUES (
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_eventos_auditoria ON eventos;
CREATE TRIGGER trigger_eventos_auditoria
AFTER INSERT OR UPDATE OR DELETE ON eventos
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

DROP TRIGGER IF EXISTS trigger_usuarios_auditoria ON usuarios;
CREATE TRIGGER trigger_usuarios_auditoria
AFTER INSERT OR UPDATE OR DELETE ON usuarios
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

DROP TRIGGER IF EXISTS trigger_tickets_auditoria ON tickets;
CREATE TRIGGER trigger_tickets_auditoria
AFTER INSERT OR UPDATE OR DELETE ON tickets
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();


-- ============================================================================
-- 10. FUNCIONES ALMACENADAS
-- ============================================================================

-- Verifica que la campaña esté vigente: estado interno 'abierto', activa y dentro del rango de fechas.
-- Estado calculado 'vigente' = estado='abierto' AND fecha_inicio <= now <= fecha_vencimiento
CREATE OR REPLACE FUNCTION evento_esta_abierto(p_evento_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE v_esta_vigente BOOLEAN;
BEGIN
  SELECT (
    estado = 'abierto'
    AND activo = TRUE
    AND fecha_inicio <= CURRENT_TIMESTAMP
    AND fecha_vencimiento > CURRENT_TIMESTAMP
  )
  INTO v_esta_vigente
  FROM eventos WHERE id = p_evento_id;
  RETURN COALESCE(v_esta_vigente, FALSE);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION crear_participacion_evento(
  p_usuario_id INTEGER,
  p_evento_id INTEGER
)
RETURNS INTEGER AS $$
DECLARE v_participacion_id INTEGER;
BEGIN
  IF NOT evento_esta_abierto(p_evento_id) THEN
    RAISE EXCEPTION 'La campaña no está disponible (no activa, fuera de fechas o estado incorrecto)';
  END IF;
  INSERT INTO participaciones_evento (usuario_id, evento_id, cupones_acumulados)
  VALUES (p_usuario_id, p_evento_id, 0)
  ON CONFLICT (usuario_id, evento_id) DO UPDATE SET activo = TRUE
  RETURNING id INTO v_participacion_id;
  RETURN v_participacion_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION obtener_cupones_por_usuario_evento(
  p_usuario_id INTEGER,
  p_evento_id INTEGER
)
RETURNS TABLE(
  usuario_id INTEGER,
  evento_id INTEGER,
  cupones_totales INTEGER,
  cantidad_tickets BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT pe.usuario_id, pe.evento_id, pe.cupones_acumulados::INTEGER, COUNT(t.id)
  FROM participaciones_evento pe
  LEFT JOIN tickets t ON pe.id = t.participacion_id AND t.activo = TRUE
  WHERE pe.usuario_id = p_usuario_id AND pe.evento_id = p_evento_id AND pe.activo = TRUE
  GROUP BY pe.usuario_id, pe.evento_id, pe.cupones_acumulados;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cerrar_evento(p_evento_id INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE eventos
  SET estado = 'cerrado',
      fecha_actualizacion = CURRENT_TIMESTAMP
  WHERE id = p_evento_id AND estado = 'abierto';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento % no encontrado o ya está cerrado', p_evento_id;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 11. VISTAS
-- ============================================================================

-- Vista de eventos vigentes (estado calculado = 'vigente'):
-- estado interno 'abierto' + activo + dentro del rango de fechas
CREATE OR REPLACE VIEW vista_campanhas_activas AS
SELECT
  id, nombre, descripcion,
  CASE
    WHEN estado = 'cerrado'                         THEN 'cerrado'
    WHEN CURRENT_TIMESTAMP < fecha_inicio           THEN 'no_iniciado'
    WHEN CURRENT_TIMESTAMP > fecha_vencimiento      THEN 'vencido'
    ELSE                                                 'vigente'
  END AS estado_calculado,
  fecha_inicio, fecha_vencimiento,
  cupones_minimos, tiene_condiciones_multiples, condiciones_cupones,
  premios, fecha_registro
FROM eventos
WHERE activo = TRUE
  AND estado = 'abierto'
  AND fecha_inicio <= CURRENT_TIMESTAMP
  AND fecha_vencimiento > CURRENT_TIMESTAMP
ORDER BY fecha_vencimiento ASC;

CREATE OR REPLACE VIEW vista_participacion_por_campanha AS
SELECT
  e.id AS evento_id,
  e.nombre AS campanha_nombre,
  CASE
    WHEN e.estado = 'cerrado'                        THEN 'cerrado'
    WHEN CURRENT_TIMESTAMP < e.fecha_inicio          THEN 'no_iniciado'
    WHEN CURRENT_TIMESTAMP > e.fecha_vencimiento     THEN 'vencido'
    ELSE                                                  'vigente'
  END AS campanha_estado,
  COUNT(DISTINCT pe.usuario_id) AS total_participantes,
  COUNT(DISTINCT t.id) AS total_tickets,
  SUM(t.cupones_generados) AS cupones_generados_total,
  AVG(pe.cupones_acumulados) AS promedio_cupones_usuario,
  MAX(pe.cupones_acumulados) AS max_cupones_usuario
FROM eventos e
LEFT JOIN participaciones_evento pe ON e.id = pe.evento_id AND pe.activo = TRUE
LEFT JOIN tickets t ON pe.id = t.participacion_id AND t.activo = TRUE
WHERE e.activo = TRUE
GROUP BY e.id, e.nombre, e.estado, e.fecha_inicio, e.fecha_vencimiento
ORDER BY e.fecha_vencimiento DESC;

CREATE OR REPLACE VIEW vista_tickets_por_campanha AS
SELECT
  t.id, t.numero_ticket, t.local,
  t.multiplicador, t.coeficiente_multiplicador,
  t.sku, t.cantidad, t.cupones_base, t.cupones_generados,
  t.foto_url, t.ocr_data, t.fecha_carga,
  u.cedula, u.nombre, u.ciudad,
  e.nombre AS campanha_nombre,
  CASE
    WHEN e.estado = 'cerrado'                        THEN 'cerrado'
    WHEN CURRENT_TIMESTAMP < e.fecha_inicio          THEN 'no_iniciado'
    WHEN CURRENT_TIMESTAMP > e.fecha_vencimiento     THEN 'vencido'
    ELSE                                                  'vigente'
  END AS campanha_estado,
  pe.cupones_acumulados AS cupones_usuario_campanha
FROM tickets t
INNER JOIN usuarios u ON t.usuario_id = u.id
INNER JOIN eventos e ON t.evento_id = e.id
INNER JOIN participaciones_evento pe ON t.participacion_id = pe.id
WHERE t.activo = TRUE AND u.activo = TRUE AND e.activo = TRUE
ORDER BY t.fecha_carga DESC;

CREATE OR REPLACE VIEW vista_estadisticas_campanhas AS
SELECT
  e.id, e.nombre, e.fecha_vencimiento,
  CASE
    WHEN e.estado = 'cerrado'                        THEN 'cerrado'
    WHEN CURRENT_TIMESTAMP < e.fecha_inicio          THEN 'no_iniciado'
    WHEN CURRENT_TIMESTAMP > e.fecha_vencimiento     THEN 'vencido'
    ELSE                                                  'vigente'
  END AS estado,
  COUNT(DISTINCT pe.usuario_id) AS usuarios_participantes,
  COUNT(t.id) AS total_tickets,
  SUM(t.cupones_generados) AS total_cupones_generados,
  CASE WHEN COUNT(t.id) = 0 THEN 0
       ELSE ROUND(AVG(t.cupones_generados)::NUMERIC, 2) END AS promedio_cupones_ticket,
  MAX(pe.cupones_acumulados) AS max_cupones_usuario
FROM eventos e
LEFT JOIN participaciones_evento pe ON e.id = pe.evento_id AND pe.activo = TRUE
LEFT JOIN tickets t ON pe.id = t.participacion_id AND t.activo = TRUE
WHERE e.activo = TRUE
GROUP BY e.id, e.nombre, e.estado, e.fecha_inicio, e.fecha_vencimiento
ORDER BY e.fecha_vencimiento DESC;


-- ============================================================================
-- 12. TABLA DE MIGRACIONES TYPEORM
-- ============================================================================

CREATE TABLE IF NOT EXISTS "typeorm_migrations" (
  "id"        SERIAL       NOT NULL,
  "timestamp" BIGINT       NOT NULL,
  "name"      VARCHAR(255) NOT NULL,
  CONSTRAINT "PK_typeorm_migrations" PRIMARY KEY ("id")
);

INSERT INTO "typeorm_migrations" ("timestamp", "name")
SELECT 1711000000000, 'Initial1711000000000'
WHERE NOT EXISTS (
  SELECT 1 FROM "typeorm_migrations" WHERE "name" = 'Initial1711000000000'
);

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
