/**
 * Flags de testing — solo activos cuando NODE_ENV !== 'production'.
 * Permiten forzar errores específicos para probar el flujo de tickets pendientes
 * sin necesidad de depender de fallos reales de Cloudinary o la base de datos.
 *
 * Variables de entorno (ver .env.example):
 *   FORCE_CLOUDINARY_ERROR=true  → el upload a Cloudinary siempre falla (etapa upload_imagen)
 *   FORCE_DB_WRITE_ERROR=true    → la escritura en BD siempre falla tras el upload (etapa escritura_db)
 *
 * ¡NUNCA activar en production! El config lo bloquea automáticamente.
 */
export const testingConfig = {
  /** Fuerza fallo en el upload a Cloudinary → genera pendiente con etapa 'upload_imagen' */
  get forceCloudinaryError(): boolean {
    if (process.env.NODE_ENV === 'production') return false;
    return process.env.FORCE_CLOUDINARY_ERROR === 'true';
  },

  /** Fuerza fallo en la escritura en BD (post-upload) → genera pendiente con etapa 'escritura_db' */
  get forceDbWriteError(): boolean {
    if (process.env.NODE_ENV === 'production') return false;
    return process.env.FORCE_DB_WRITE_ERROR === 'true';
  },
};
