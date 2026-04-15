export const REGEX = {
  CEDULA: /^\d{6,10}$/,
  CELULAR: /^(\+?[0-9]{7,15})$/,
  /** Grupos de mínimo 3 dígitos separados por guión. Ej: 001-002-003, 1234-5678-9012 */
  NUMERO_FACTURA: /^\d{3,}(-\d{3,})+$/,
} as const;
