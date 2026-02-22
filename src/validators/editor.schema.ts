import { z } from 'zod';

export const beautySuggestSchema = z.object({
  skinTone: z.string().optional(),
  skinType: z.string().optional(),
  facialFeatures: z.record(z.unknown()).optional(),
  lightingConditions: z.string().optional(),
  imageResolution: z.object({ width: z.number(), height: z.number() }).optional(),
  detectedIssues: z.array(z.string()).optional(),
});
export type BeautySuggestInput = z.infer<typeof beautySuggestSchema>;

export const autoEnhanceSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  format: z.string(),
  fileSize: z.number().positive(),
  colorSpace: z.string().optional(),
  exif: z.record(z.unknown()).optional(),
  histogram: z.record(z.array(z.number())).optional(),
});
export type AutoEnhanceInput = z.infer<typeof autoEnhanceSchema>;

export const editingTipsSchema = z.object({
  imageMetadata: autoEnhanceSchema,
  currentParams: z.object({
    brightness: z.number().optional(),
    contrast: z.number().optional(),
    saturation: z.number().optional(),
    warmth: z.number().optional(),
    sharpness: z.number().optional(),
    highlights: z.number().optional(),
    shadows: z.number().optional(),
    clarity: z.number().optional(),
    vibrance: z.number().optional(),
    exposure: z.number().optional(),
  }),
});
export type EditingTipsInput = z.infer<typeof editingTipsSchema>;
