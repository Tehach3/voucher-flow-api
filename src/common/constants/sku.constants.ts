export const SKU_CUPONES: Record<string, number> = {
  '250g': 2,
  '500g': 3,
  '1kg': 5,
  '5kg': 15,
};

export const SKU_VALUES = Object.keys(SKU_CUPONES) as [string, ...string[]];

export type SkuType = keyof typeof SKU_CUPONES;
