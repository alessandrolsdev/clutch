import { z } from 'zod';

export const uploadedImageResponseSchema = z.object({
  url: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative(),
});

export type UploadedImageResponse = z.infer<typeof uploadedImageResponseSchema>;
