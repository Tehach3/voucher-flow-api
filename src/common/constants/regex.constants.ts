export const REGEX = {
  CEDULA: /^\d{8}$/,
  CELULAR: /^(\+?[0-9]{7,15})$/,
  NUMERO_FACTURA: /^[A-Za-z0-9\-_]{1,50}$/,
} as const;
