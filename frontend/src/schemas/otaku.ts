import { z } from 'zod';

export const otakuLibraryEntrySchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['ANIME', 'MANGA']),
  title: z.string().min(1),
  coverUrl: z.string().nullable(),
  status: z.enum(['PLANNING', 'CONSUMING', 'COMPLETED', 'PAUSED', 'DROPPED']),
  progress: z.number().int().min(0).nullable(),
  score: z.number().int().min(0).nullable(),
  showcaseRank: z.number().int().min(1).nullable(),
  updatedAt: z.string().min(1),
});

export const otakuLibraryResponseSchema = z.object({
  entries: z.array(otakuLibraryEntrySchema),
  maxShowcaseItems: z.number().int().min(1),
});

export const otakuShowcaseUpdateRequestSchema = z.object({
  showcaseRank: z.number().int().min(1).nullable(),
});

export const otakuShowcaseUpdateResponseSchema = z.object({
  entry: otakuLibraryEntrySchema,
});

export type OtakuLibraryEntry = z.infer<typeof otakuLibraryEntrySchema>;
export type OtakuLibraryResponse = z.infer<typeof otakuLibraryResponseSchema>;
export type OtakuShowcaseUpdateValues = z.infer<typeof otakuShowcaseUpdateRequestSchema>;
export type OtakuShowcaseUpdateResponse = z.infer<typeof otakuShowcaseUpdateResponseSchema>;
