-- ============================================================================
-- MIGRACIÓN: tickets_pendientes v1
-- Descripción: Tabla de reintentos para tickets que fallaron por error en
--              Cloudinary o error en la transacción de DB.
-- Aplicar sobre: bases de datos existentes que ya tienen la estructura v2
-- ============================================================================

CREATE TABLE IF NOT EXISTS tickets_pendientes (
  id SERIAL PRIMARY KEY,

  datos_formulario JSONB NOT NULL,

  foto_url VARCHAR(500),
  foto_buffer_b64 TEXT,
  foto_mimetype VARCHAR(50),

  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'procesando', 'completado', 'fallido_permanente')),

  etapa_error VARCHAR(20) NOT NULL
    CHECK (etapa_error IN ('upload_imagen', 'escritura_db')),

  mensaje_error TEXT,
  intentos INTEGER NOT NULL DEFAULT 0,

  fecha_registro TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_ultimo_intento TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_pendientes_estado ON tickets_pendientes(estado);
CREATE INDEX IF NOT EXISTS idx_pendientes_estado_fecha ON tickets_pendientes(estado, fecha_registro ASC);
CREATE INDEX IF NOT EXISTS idx_pendientes_cedula ON tickets_pendientes((datos_formulario->>'cedula'));
CREATE INDEX IF NOT EXISTS idx_pendientes_evento ON tickets_pendientes(((datos_formulario->>'eventoId')::int));

COMMENT ON TABLE tickets_pendientes IS 'Tickets que fallaron (upload o escritura DB) y quedaron guardados para reintento automático o manual';
COMMENT ON COLUMN tickets_pendientes.datos_formulario IS 'Snapshot del formulario: {cedula, nombre, celular, ciudad, email, eventoId, numeroTicket, productos}';
COMMENT ON COLUMN tickets_pendientes.foto_url IS 'URL de Cloudinary. Presente si la imagen fue subida pero DB falló.';
COMMENT ON COLUMN tickets_pendientes.foto_buffer_b64 IS 'Imagen en base64. Presente si Cloudinary falló. Se limpia tras upload exitoso en reintento.';
COMMENT ON COLUMN tickets_pendientes.estado IS 'pendiente=espera reintento, procesando=en proceso, completado=OK, fallido_permanente=superó max intentos';
COMMENT ON COLUMN tickets_pendientes.etapa_error IS 'upload_imagen=Cloudinary falló, escritura_db=transacción DB falló';

-- También actualizar cedula en usuarios a VARCHAR(10) si no se hizo antes
ALTER TABLE usuarios
  ALTER COLUMN cedula TYPE VARCHAR(10);
