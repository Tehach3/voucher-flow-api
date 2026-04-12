export const cloudinaryConfig = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  apiKey: process.env.CLOUDINARY_API_KEY ?? '',
  apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
  /** Si CLOUDINARY_MOCK=true, el servicio siempre responde con un stub exitoso */
  isMockMode(): boolean {
    return process.env.CLOUDINARY_MOCK === 'true';
  },
  isConfigured(): boolean {
    return !!(this.cloudName && this.apiKey && this.apiSecret);
  },
};
