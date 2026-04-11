-- ============================================================================
-- INICIALIZACIÓN DE BASE DE DATOS - PLATAFORMA DE SORTEOS
-- ============================================================================
-- Descripción: Script SQL para crear tablas, índices, constraints y data inicial
-- Soporta múltiples eventos con validación de cupones por evento
-- Base de datos: voucher-flow-db
-- Versión: 1.0
-- ============================================================================

-- ============================================================================
-- 1. CREAR EXTENSIONES NECESARIAS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- ============================================================================
-- 2. CREAR TABLA: EVENTOS
-- ============================================================================
-- Almacena información de los eventos/campañas de sorteo

CREATE TABLE IF NOT EXISTS eventos (
  id SERIAL PRIMARY KEY,
  
  -- Identificación
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  
  -- Control de estado
  estado VARCHAR(20) NOT NULL DEFAULT 'abierto' 
    CHECK (estado IN ('abierto', 'cerrado', 'pausado', 'finalizado')),
  
  -- Fechas
  fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_vencimiento TIMESTAMP WITH TIME ZONE NOT NULL,
  fecha_cierre TIMESTAMP WITH TIME ZONE,
  
  -- Configuración de validación de cupones
  require_validacion_cupones BOOLEAN NOT NULL DEFAULT FALSE,
  cupones_minimos INTEGER DEFAULT 1 CHECK (cupones_minimos >= 1),
  
  -- Configuración de SKUs válidos
  skus_validos VARCHAR(10)[] NOT NULL DEFAULT ARRAY['250g', '500g', '1kg', '5kg'],
  
  -- Metadata
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_registro TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Datos adicionales
  imagen_url VARCHAR(500),
  premio_descripcion TEXT
);

-- Crear índices en tabla eventos
CREATE UNIQUE INDEX idx_eventos_nombre ON eventos(nombre) WHERE activo = TRUE;
CREATE INDEX idx_eventos_estado ON eventos(estado);
CREATE INDEX idx_eventos_activo ON eventos(activo);
CREATE INDEX idx_eventos_fecha_vencimiento ON eventos(fecha_vencimiento DESC);
CREATE INDEX idx_eventos_fecha_inicio ON eventos(fecha_inicio DESC);

-- Comentarios
COMMENT ON TABLE eventos IS 'Tabla de eventos/campañas de sorteo';
COMMENT ON COLUMN eventos.estado IS 'Estado del evento: abierto, cerrado, pausado, finalizado';
COMMENT ON COLUMN eventos.fecha_vencimiento IS 'Fecha límite para participar en el evento';
COMMENT ON COLUMN eventos.require_validacion_cupones IS 'Si TRUE, se valida cupones_minimos';
COMMENT ON COLUMN eventos.cupones_minimos IS 'Mínimo de cupones requeridos para participar (si validación habilitada)';
COMMENT ON COLUMN eventos.skus_validos IS 'Array de SKUs válidos para este evento';


-- ============================================================================
-- 3. CREAR TABLA: USUARIOS
-- ============================================================================
-- Almacena información de usuarios y sus datos personales

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  
  -- Identificación
  cedula VARCHAR(8) NOT NULL UNIQUE,
  nombre VARCHAR(255) NOT NULL,
  celular VARCHAR(20),
  ciudad VARCHAR(100),
  email VARCHAR(255),
  
  -- Metadata
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_registro TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices en tabla usuarios
CREATE UNIQUE INDEX idx_usuarios_cedula ON usuarios(cedula);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);
CREATE INDEX idx_usuarios_email ON usuarios(email) WHERE email IS NOT NULL;
CREATE INDEX idx_usuarios_fecha_registro ON usuarios(fecha_registro DESC);

-- Comentarios
COMMENT ON TABLE usuarios IS 'Tabla de usuarios que participan en eventos';
COMMENT ON COLUMN usuarios.cedula IS 'Cédula única del usuario (8 dígitos)';


-- ============================================================================
-- 4. CREAR TABLA: PARTICIPACIONES POR EVENTO
-- ============================================================================
-- Relación entre usuarios y eventos con cupones acumulados por evento

CREATE TABLE IF NOT EXISTS participaciones_evento (
  id SERIAL PRIMARY KEY,
  
  -- Relaciones
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  
  -- Cupones
  cupones_acumulados INTEGER NOT NULL DEFAULT 0 CHECK (cupones_acumulados >= 0),
  
  -- Metadata
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_registro TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraint único: mismo usuario no puede duplicar en mismo evento
  UNIQUE(usuario_id, evento_id)
);

-- Crear índices
CREATE INDEX idx_participaciones_usuario_id ON participaciones_evento(usuario_id);
CREATE INDEX idx_participaciones_evento_id ON participaciones_evento(evento_id);
CREATE INDEX idx_participaciones_usuario_evento ON participaciones_evento(usuario_id, evento_id);
CREATE INDEX idx_participaciones_cupones ON participaciones_evento(cupones_acumulados DESC);
CREATE INDEX idx_participaciones_activo ON participaciones_evento(activo);

-- Comentarios
COMMENT ON TABLE participaciones_evento IS 'Participación de usuario en evento con cupones acumulados';


-- ============================================================================
-- 5. CREAR TABLA: FACTURAS
-- ============================================================================
-- Almacena información de facturas cargadas por usuarios en cada evento

CREATE TABLE IF NOT EXISTS facturas (
  id SERIAL PRIMARY KEY,
  
  -- Relaciones
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  participacion_id INTEGER NOT NULL REFERENCES participaciones_evento(id) ON DELETE CASCADE,
  
  -- Información de factura
  numero_factura VARCHAR(50) NOT NULL,
  sku VARCHAR(10) NOT NULL CHECK (sku IN ('250g', '500g', '1kg', '5kg')),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  
  -- Cupones generados
  cupones_generados INTEGER NOT NULL CHECK (cupones_generados >= 0),
  
  -- Información de imagen
  foto_url VARCHAR(500) NOT NULL,
  
  -- OCR Data (JSON)
  ocr_data JSONB,
  
  -- Timestamps
  fecha_carga TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Metadata
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Constraint único: mismo usuario no puede cargar misma factura dos veces EN MISMO EVENTO
  UNIQUE(evento_id, usuario_id, numero_factura)
);

-- Crear índices
CREATE INDEX idx_facturas_usuario_id ON facturas(usuario_id);
CREATE INDEX idx_facturas_evento_id ON facturas(evento_id);
CREATE INDEX idx_facturas_participacion_id ON facturas(participacion_id);
CREATE INDEX idx_facturas_numero_factura ON facturas(numero_factura);
CREATE INDEX idx_facturas_sku ON facturas(sku);
CREATE INDEX idx_facturas_fecha_carga ON facturas(fecha_carga DESC);
CREATE INDEX idx_facturas_activo ON facturas(activo);
CREATE INDEX idx_facturas_usuario_evento_fecha ON facturas(usuario_id, evento_id, fecha_carga DESC);

-- Comentarios
COMMENT ON TABLE facturas IS 'Tabla de facturas cargadas por usuarios en eventos';
COMMENT ON COLUMN facturas.evento_id IS 'ID del evento al cual pertenece la factura';
COMMENT ON COLUMN facturas.participacion_id IS 'ID de la participación del usuario en el evento';


-- ============================================================================
-- 6. CREAR TABLA: AUDITORIA
-- ============================================================================
-- Tabla para registrar cambios importantes en el sistema

CREATE TABLE IF NOT EXISTS auditoria (
  id SERIAL PRIMARY KEY,
  
  -- Tipo de evento
  evento_tipo VARCHAR(50) NOT NULL,
  entidad VARCHAR(50) NOT NULL,
  entidad_id INTEGER,
  
  -- Usuario/Sistema
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  
  -- Datos
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  
  -- Timestamp
  fecha_evento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices para auditoria
CREATE INDEX idx_auditoria_evento ON auditoria(evento_tipo);
CREATE INDEX idx_auditoria_entidad ON auditoria(entidad, entidad_id);
CREATE INDEX idx_auditoria_fecha ON auditoria(fecha_evento DESC);


-- ============================================================================
-- 7. CREAR FUNCIONES: TRIGGERS PARA ACTUALIZAR fecha_actualizacion
-- ============================================================================

CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar timestamp
DROP TRIGGER IF EXISTS trigger_eventos_actualizar_fecha ON eventos;
CREATE TRIGGER trigger_eventos_actualizar_fecha
BEFORE UPDATE ON eventos
FOR EACH ROW
EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_usuarios_actualizar_fecha ON usuarios;
CREATE TRIGGER trigger_usuarios_actualizar_fecha
BEFORE UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_participaciones_actualizar_fecha ON participaciones_evento;
CREATE TRIGGER trigger_participaciones_actualizar_fecha
BEFORE UPDATE ON participaciones_evento
FOR EACH ROW
EXECUTE FUNCTION actualizar_fecha_actualizacion();


-- ============================================================================
-- 8. CREAR FUNCIONES: ACTUALIZAR CUPONES EN PARTICIPACIÓN
-- ============================================================================

CREATE OR REPLACE FUNCTION actualizar_cupones_participacion()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar cupones acumulados en participación
  UPDATE participaciones_evento
  SET cupones_acumulados = cupones_acumulados + NEW.cupones_generados
  WHERE id = NEW.participacion_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar cupones al insertar factura
DROP TRIGGER IF EXISTS trigger_facturas_actualizar_cupones ON facturas;
CREATE TRIGGER trigger_facturas_actualizar_cupones
AFTER INSERT ON facturas
FOR EACH ROW
EXECUTE FUNCTION actualizar_cupones_participacion();


-- ============================================================================
-- 9. CREAR FUNCIONES: REGISTRAR EN AUDITORIA
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

-- Triggers para auditoria
DROP TRIGGER IF EXISTS trigger_eventos_auditoria ON eventos;
CREATE TRIGGER trigger_eventos_auditoria
AFTER INSERT OR UPDATE OR DELETE ON eventos
FOR EACH ROW
EXECUTE FUNCTION registrar_auditoria();

DROP TRIGGER IF EXISTS trigger_usuarios_auditoria ON usuarios;
CREATE TRIGGER trigger_usuarios_auditoria
AFTER INSERT OR UPDATE OR DELETE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION registrar_auditoria();

DROP TRIGGER IF EXISTS trigger_facturas_auditoria ON facturas;
CREATE TRIGGER trigger_facturas_auditoria
AFTER INSERT OR UPDATE OR DELETE ON facturas
FOR EACH ROW
EXECUTE FUNCTION registrar_auditoria();


-- ============================================================================
-- 10. CREAR FUNCIONES ALMACENADAS ÚTILES
-- ============================================================================

-- Función para validar si evento está abierto
CREATE OR REPLACE FUNCTION evento_esta_abierto(p_evento_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_esta_abierto BOOLEAN;
BEGIN
  SELECT 
    (estado = 'abierto' AND fecha_vencimiento > CURRENT_TIMESTAMP)
  INTO v_esta_abierto
  FROM eventos
  WHERE id = p_evento_id AND activo = TRUE;
  
  RETURN COALESCE(v_esta_abierto, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Función para crear participación de usuario en evento
CREATE OR REPLACE FUNCTION crear_participacion_evento(
  p_usuario_id INTEGER,
  p_evento_id INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_participacion_id INTEGER;
BEGIN
  -- Verificar que evento existe y está abierto
  IF NOT evento_esta_abierto(p_evento_id) THEN
    RAISE EXCEPTION 'Evento no está abierto o ha vencido';
  END IF;
  
  -- Crear participación si no existe
  INSERT INTO participaciones_evento (usuario_id, evento_id, cupones_acumulados)
  VALUES (p_usuario_id, p_evento_id, 0)
  ON CONFLICT (usuario_id, evento_id) DO UPDATE
  SET activo = TRUE
  RETURNING id INTO v_participacion_id;
  
  RETURN v_participacion_id;
END;
$$ LANGUAGE plpgsql;

-- Función para calcular cupones por SKU
CREATE OR REPLACE FUNCTION calcular_cupones_por_sku(p_sku VARCHAR(10), p_cantidad INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_cupones INTEGER;
BEGIN
  CASE p_sku
    WHEN '250g' THEN v_cupones := 2 * p_cantidad;
    WHEN '500g' THEN v_cupones := 3 * p_cantidad;
    WHEN '1kg' THEN v_cupones := 5 * p_cantidad;
    WHEN '5kg' THEN v_cupones := 15 * p_cantidad;
    ELSE v_cupones := 0;
  END CASE;
  
  RETURN v_cupones;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener cupones por usuario en evento
CREATE OR REPLACE FUNCTION obtener_cupones_por_usuario_evento(
  p_usuario_id INTEGER,
  p_evento_id INTEGER
)
RETURNS TABLE(
  usuario_id INTEGER,
  evento_id INTEGER,
  cupones_totales INTEGER,
  cantidad_facturas BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pe.usuario_id,
    pe.evento_id,
    pe.cupones_acumulados::INTEGER,
    COUNT(f.id)
  FROM participaciones_evento pe
  LEFT JOIN facturas f ON pe.id = f.participacion_id AND f.activo = TRUE
  WHERE pe.usuario_id = p_usuario_id 
    AND pe.evento_id = p_evento_id 
    AND pe.activo = TRUE
  GROUP BY pe.usuario_id, pe.evento_id, pe.cupones_acumulados;
END;
$$ LANGUAGE plpgsql;

-- Función para cerrar evento manualmente
CREATE OR REPLACE FUNCTION cerrar_evento(p_evento_id INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE eventos
  SET estado = 'cerrado',
      fecha_cierre = CURRENT_TIMESTAMP,
      fecha_actualizacion = CURRENT_TIMESTAMP
  WHERE id = p_evento_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 11. CREAR VISTAS ÚTILES
-- ============================================================================

-- Vista: Eventos activos
CREATE OR REPLACE VIEW vista_eventos_activos AS
SELECT
  id,
  nombre,
  descripcion,
  estado,
  fecha_inicio,
  fecha_vencimiento,
  require_validacion_cupones,
  cupones_minimos,
  skus_validos,
  fecha_registro
FROM eventos
WHERE activo = TRUE AND estado IN ('abierto', 'pausado')
ORDER BY fecha_vencimiento ASC;

-- Vista: Resumen de participación por evento
CREATE OR REPLACE VIEW vista_participacion_por_evento AS
SELECT
  e.id AS evento_id,
  e.nombre AS evento_nombre,
  e.estado AS evento_estado,
  COUNT(DISTINCT pe.usuario_id) AS total_participantes,
  COUNT(DISTINCT f.id) AS total_facturas,
  SUM(f.cupones_generados) AS cupones_generados_total,
  AVG(pe.cupones_acumulados) AS promedio_cupones_usuario,
  MAX(pe.cupones_acumulados) AS max_cupones_usuario
FROM eventos e
LEFT JOIN participaciones_evento pe ON e.id = pe.evento_id AND pe.activo = TRUE
LEFT JOIN facturas f ON pe.id = f.participacion_id AND f.activo = TRUE
WHERE e.activo = TRUE
GROUP BY e.id, e.nombre, e.estado
ORDER BY e.fecha_vencimiento DESC;

-- Vista: Facturas detalladas por evento
CREATE OR REPLACE VIEW vista_facturas_por_evento AS
SELECT
  f.id,
  f.numero_factura,
  f.sku,
  f.cantidad,
  f.cupones_generados,
  f.foto_url,
  f.ocr_data,
  f.fecha_carga,
  u.cedula,
  u.nombre,
  u.ciudad,
  e.nombre AS evento_nombre,
  e.estado AS evento_estado,
  pe.cupones_acumulados AS cupones_usuario_evento
FROM facturas f
INNER JOIN usuarios u ON f.usuario_id = u.id
INNER JOIN eventos e ON f.evento_id = e.id
INNER JOIN participaciones_evento pe ON f.participacion_id = pe.id
WHERE f.activo = TRUE AND u.activo = TRUE AND e.activo = TRUE
ORDER BY f.fecha_carga DESC;

-- Vista: Estadísticas generales por evento
CREATE OR REPLACE VIEW vista_estadisticas_eventos AS
SELECT
  e.id,
  e.nombre,
  e.estado,
  e.fecha_vencimiento,
  COUNT(DISTINCT pe.usuario_id) AS usuarios_participantes,
  COUNT(f.id) AS total_facturas,
  SUM(f.cupones_generados) AS total_cupones_generados,
  CASE 
    WHEN COUNT(f.id) = 0 THEN 0
    ELSE ROUND(AVG(f.cupones_generados)::NUMERIC, 2)
  END AS promedio_cupones_factura,
  MAX(pe.cupones_acumulados) AS max_cupones_usuario
FROM eventos e
LEFT JOIN participaciones_evento pe ON e.id = pe.evento_id AND pe.activo = TRUE
LEFT JOIN facturas f ON pe.id = f.participacion_id AND f.activo = TRUE
WHERE e.activo = TRUE
GROUP BY e.id, e.nombre, e.estado, e.fecha_vencimiento
ORDER BY e.fecha_vencimiento DESC;


-- ============================================================================
-- 13. CREAR ÍNDICES ADICIONALES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_participaciones_evento_estado 
  ON participaciones_evento(evento_id, activo);

CREATE INDEX IF NOT EXISTS idx_facturas_evento_usuario 
  ON facturas(evento_id, usuario_id);


-- ============================================================================
-- 14. VERIFICACIÓN FINAL
-- ============================================================================

-- Verificación de estructura
-- Descomenta para verificar después de instalación:
-- SELECT COUNT(*) AS total_eventos FROM eventos;
-- SELECT COUNT(*) AS total_usuarios FROM usuarios;
-- SELECT COUNT(*) AS total_participaciones FROM participaciones_evento;
-- SELECT COUNT(*) AS total_facturas FROM facturas;
-- SELECT * FROM vista_eventos_activos LIMIT 5;
-- SELECT * FROM vista_participacion_por_evento LIMIT 5;


-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================