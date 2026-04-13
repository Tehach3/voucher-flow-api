export const ERROR_CODES = {
  // ── Autenticación ─────────────────────────────────────────────────────────
  MISSING_API_KEY:       'AUTH_001',
  INVALID_AUTH_FORMAT:   'AUTH_002',
  INVALID_API_KEY:       'AUTH_003',
  HMAC_MISSING:          'AUTH_004',
  HMAC_EXPIRED:          'AUTH_005',
  HMAC_INVALID:          'AUTH_006',
  HMAC_CONFIG:           'AUTH_007',

  // ── Eventos / Campañas ────────────────────────────────────────────────────
  EVENTO_NOT_FOUND:          'EVT_001',
  EVENTO_INACTIVE:           'EVT_002',
  EVENTO_CLOSED:             'EVT_003',
  EVENTO_NOT_STARTED:        'EVT_004',
  EVENTO_EXPIRED:            'EVT_005',
  EVENTO_UPDATE_CLOSED:      'EVT_006',
  EVENTO_ALREADY_CLOSED:     'EVT_007',
  EVENTO_INVALID_DATE:       'EVT_008',
  EVENTO_INVALID_CONDITIONS: 'EVT_009',

  // ── Facturas / Tickets ────────────────────────────────────────────────────
  FACTURA_ALREADY_EXISTS:    'FAC_001',
  FACTURA_NOT_FOUND:         'FAC_002',
  INVALID_SKU:               'FAC_003',
  PENDING_NOT_FOUND:         'FAC_004',
  PENDING_ALREADY_PROCESSED: 'FAC_005',
  PENDING_PROCESSING:        'FAC_006',
  UPLOAD_FALLIDO:            'FAC_007',
  PERSISTENCIA_FALLIDA:      'FAC_008',

  // ── Imágenes ──────────────────────────────────────────────────────────────
  INVALID_FILE_TYPE: 'IMG_001',
  FILE_TOO_LARGE:    'IMG_002',
  UPLOAD_FAILED:     'IMG_003',
  IMAGE_DUPLICATE:   'IMG_004',
  IMAGE_MISSING:     'IMG_005',

  // ── Usuarios / Participantes ──────────────────────────────────────────────
  USUARIO_NOT_FOUND:    'USR_001',
  USUARIO_ALREADY_EXISTS: 'USR_002',
  NOMBRE_REQUIRED:      'USR_003',
  PARTICIPACION_FAILED: 'USR_004',

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  RATE_LIMIT_EXCEEDED: 'RATE_001',

  // ── Validación ────────────────────────────────────────────────────────────
  VALIDATION_ERROR: 'VAL_001',

  // ── Servidor ──────────────────────────────────────────────────────────────
  INTERNAL_ERROR:      'SRV_001',
  SERVER_CONFIG_ERROR: 'SRV_002',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
