export const cloudinaryConfig = {
  get cloudName() { return process.env.CLOUDINARY_CLOUD_NAME ?? ''; },
  get apiKey()    { return process.env.CLOUDINARY_API_KEY ?? ''; },
  get apiSecret() { return process.env.CLOUDINARY_API_SECRET ?? ''; },
  /** Si CLOUDINARY_MOCK=true, el servicio siempre responde con un stub exitoso */
  isMockMode(): boolean {
    return process.env.CLOUDINARY_MOCK === 'true';
  },
  isConfigured(): boolean {
    return !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  },
};
