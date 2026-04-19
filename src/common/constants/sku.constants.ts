// URL devuelta al frontend mientras el upload a Cloudinary está en curso.
// Se reemplaza por la URL real una vez que el upload async completa.
// Los reportes muestran esta URL si consultan antes de que el upload termine.
export const FOTO_PROCESANDO_URL = 'https://placehold.co/800x600/e2e8f0/64748b?text=Procesando+imagen...';

export const SKU_CUPONES: Record<string, number> = {
  '250g': 2,
  '500g': 3,
  '1kg': 5,
  '5kg': 15,
};

export const SKU_VALUES = Object.keys(SKU_CUPONES) as [string, ...string[]];

export type SkuType = keyof typeof SKU_CUPONES;
