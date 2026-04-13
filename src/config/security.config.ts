export const securityConfig = {
  get apiKey() { return process.env.API_KEY ?? ''; },
  get rateLimit() {
    return {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
      max: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
    };
  },
  get hmac() {
    return {
      enabled: process.env.SECURITY_HMAC_ENABLED === 'true',
      secret: process.env.APP_HMAC_SECRET ?? '',
      // Ventana de tiempo aceptada para el timestamp (segundos). Por defecto 5 minutos.
      windowSecs: parseInt(process.env.SECURITY_HMAC_WINDOW_SECS ?? '300', 10),
    };
  },
  get audit() {
    return { enabled: process.env.SECURITY_AUDIT_ENABLED === 'true' };
  },
  get imageHash() {
    return { enabled: process.env.SECURITY_IMAGE_HASH_ENABLED === 'true' };
  },
};
