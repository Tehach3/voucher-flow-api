import { ErrorCode } from './error.constants';

export interface ErrorMessages {
  /** Mensaje técnico para logs y debugging (inglés) */
  sistema: string;
  /** Mensaje localizado para el usuario final (español) */
  mensaje: string;
}

/**
 * Catálogo centralizado de mensajes por código de error.
 *
 * Para personalizar los textos:
 *  - Edita el campo `mensaje` para cambiar el texto que ve el usuario.
 *  - Edita el campo `sistema` para ajustar el texto que aparece en logs y herramientas de monitoreo.
 *
 * Los códigos se definen en error.constants.ts.
 * El HttpExceptionFilter los serializa automáticamente en cada respuesta de error.
 */
export const APP_MESSAGES: Record<ErrorCode, ErrorMessages> = {
  // ── Autenticación ─────────────────────────────────────────────────────────
  AUTH_001: {
    sistema: 'Request is missing the required x-api-key header',
    mensaje: 'Se requiere el header x-api-key para autenticar la solicitud',
  },
  AUTH_002: {
    sistema: 'Invalid authentication format',
    mensaje: 'Formato de autenticación inválido',
  },
  AUTH_003: {
    sistema: 'Provided API key does not match the configured value',
    mensaje: 'La API Key proporcionada no es válida',
  },
  AUTH_004: {
    sistema: 'HMAC request signature or timestamp header is missing',
    mensaje: 'Firma de seguridad ausente. Se requieren los headers X-Signature y X-Timestamp',
  },
  AUTH_005: {
    sistema: 'HMAC timestamp is expired or outside the allowed window',
    mensaje: 'La solicitud expiró o el timestamp está fuera del rango permitido',
  },
  AUTH_006: {
    sistema: 'HMAC signature does not match the expected value',
    mensaje: 'La firma de seguridad de la solicitud no es válida',
  },
  AUTH_007: {
    sistema: 'HMAC secret (APP_HMAC_SECRET) is not configured on the server',
    mensaje: 'Error de configuración de firma en el servidor. Contacte al administrador',
  },

  // ── Eventos / Campañas ────────────────────────────────────────────────────
  EVT_001: {
    sistema: 'Event not found for the provided id',
    mensaje: 'La campaña solicitada no existe',
  },
  EVT_002: {
    sistema: 'Event activo flag is false',
    mensaje: 'La campaña no está activa actualmente',
  },
  EVT_003: {
    sistema: 'Event estadoInterno is closed',
    mensaje: 'La campaña está cerrada y no acepta nuevos tickets',
  },
  EVT_004: {
    sistema: 'Event has not started yet (fechaInicio is in the future)',
    mensaje: 'La campaña aún no ha iniciado',
  },
  EVT_005: {
    sistema: 'Event has already expired (fechaCierre is in the past)',
    mensaje: 'La campaña ha finalizado y no acepta nuevos tickets',
  },
  EVT_006: {
    sistema: 'Cannot update an event whose estadoInterno is closed',
    mensaje: 'No se puede modificar un evento que ya está cerrado',
  },
  EVT_007: {
    sistema: 'Event is already in closed state, cannot close again',
    mensaje: 'El evento ya se encuentra cerrado',
  },
  EVT_008: {
    sistema: 'Event date validation failed: fechaCierre must be in the future and after fechaInicio',
    mensaje: 'Las fechas del evento no son válidas. Verifique que fechaCierre sea futura y posterior a fechaInicio',
  },
  EVT_009: {
    sistema: 'condicionesCupones count does not match tieneCondicionesMultiples flag',
    mensaje: 'La configuración de condiciones de cupones no corresponde al tipo de campaña',
  },

  // ── Facturas / Tickets ────────────────────────────────────────────────────
  FAC_001: {
    sistema: 'Invoice number (numeroTicket) already registered for this campaign',
    mensaje: 'El número de factura ingresado ya generó cupones en esta campaña',
  },
  FAC_002: {
    sistema: 'Invoice not found for the provided id',
    mensaje: 'La factura solicitada no existe',
  },
  FAC_003: {
    sistema: 'One or more product SKUs are not valid for this campaign',
    mensaje: 'Uno o más productos no son válidos para esta campaña',
  },
  FAC_004: {
    sistema: 'Pending ticket not found for the provided id',
    mensaje: 'El ticket pendiente solicitado no existe',
  },
  FAC_005: {
    sistema: 'Pending ticket was already successfully processed',
    mensaje: 'Este ticket pendiente ya fue procesado exitosamente',
  },
  FAC_006: {
    sistema: 'Pending ticket is currently being retried by another process',
    mensaje: 'Este ticket pendiente ya está siendo procesado. Intente nuevamente en unos momentos',
  },
  FAC_007: {
    sistema: 'Image upload to Cloudinary failed; ticket data saved as pending for automatic retry',
    mensaje: 'Error al procesar la imagen. Sus datos fueron guardados para reintento automático',
  },
  FAC_008: {
    sistema: 'Database write failed after successful upload; ticket saved as pending for automatic retry',
    mensaje: 'Imagen subida correctamente. Error al guardar los datos. Guardados para reintento automático',
  },

  // ── Imágenes ──────────────────────────────────────────────────────────────
  IMG_001: {
    sistema: 'File MIME type is not allowed (expected image/jpeg or image/png)',
    mensaje: 'Tipo de archivo no permitido. Solo se aceptan imágenes JPG o PNG',
  },
  IMG_002: {
    sistema: 'File size exceeds the maximum allowed limit of 5 MB',
    mensaje: 'La imagen supera el tamaño máximo permitido de 5 MB',
  },
  IMG_003: {
    sistema: 'Cloudinary upload request failed with an SDK error',
    mensaje: 'Error al subir la imagen al almacenamiento. Intente nuevamente',
  },
  IMG_004: {
    sistema: 'Image SHA-256 hash already exists for this campaign — possible duplicate submission',
    mensaje: 'Esta imagen ya fue utilizada en esta campaña',
  },
  IMG_005: {
    sistema: 'Image is not available for processing (no Cloudinary URL and no base64 buffer stored)',
    mensaje: 'La imagen del ticket no está disponible para procesar',
  },

  // ── Usuarios / Participantes ──────────────────────────────────────────────
  USR_001: {
    sistema: 'Participant not found for the provided cedula',
    mensaje: 'El participante con la cédula indicada no existe',
  },
  USR_002: {
    sistema: 'Participant already exists with this cedula',
    mensaje: 'Ya existe un participante registrado con esta cédula',
  },
  USR_003: {
    sistema: 'Field nombre is required when registering a new participant',
    mensaje: 'El campo nombre es obligatorio para registrar a un nuevo participante',
  },
  USR_004: {
    sistema: 'Could not find or create the campaign participation record in the database',
    mensaje: 'No se pudo registrar la participación en la campaña. Intente nuevamente',
  },

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  RATE_001: {
    sistema: 'Too many requests from this IP within the configured time window',
    mensaje: 'Demasiadas solicitudes. Intente nuevamente más tarde',
  },

  // ── Validación ────────────────────────────────────────────────────────────
  VAL_001: {
    sistema: 'Request body failed DTO validation (class-validator rules)',
    mensaje: 'Los datos enviados no son válidos. Verifique el formato de cada campo',
  },

  // ── Servidor ──────────────────────────────────────────────────────────────
  SRV_001: {
    sistema: 'Unexpected internal server error',
    mensaje: 'Error interno del servidor. Contacte al administrador si el problema persiste',
  },
  SRV_002: {
    sistema: 'Server configuration error — required environment variable may be missing or invalid',
    mensaje: 'Error de configuración en el servidor. Contacte al administrador',
  },
};
