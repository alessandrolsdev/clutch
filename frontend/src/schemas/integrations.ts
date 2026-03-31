import { z } from 'zod';

export const steamConnectRequestSchema = z.object({
  steamId: z.string().trim().min(1, 'SteamID e obrigatorio.'),
});

export const steamConnectResponseSchema = z.object({
  message: z.string().min(1),
  imported: z.number().int().min(0),
});

export const steamSyncResponseSchema = z.object({
  message: z.string().min(1),
  synced: z.number().int().min(0),
});

export const epicConnectRequestSchema = z.object({
  authToken: z.string().trim().min(1, 'Token Epic e obrigatorio.'),
});

export const epicConnectResponseSchema = z.object({
  message: z.string().min(1),
  imported: z.number().int().min(0),
});

export const igdbSearchRequestSchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, 'Digite pelo menos 2 caracteres para buscar no IGDB.'),
});

export const igdbSearchResponseSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  coverUrl: z.string().nullable(),
  platforms: z.array(z.string()),
  summary: z.string().nullable(),
});

export type SteamConnectValues = z.infer<typeof steamConnectRequestSchema>;
export type SteamConnectResponse = z.infer<typeof steamConnectResponseSchema>;
export type SteamSyncResponse = z.infer<typeof steamSyncResponseSchema>;
export type EpicConnectValues = z.infer<typeof epicConnectRequestSchema>;
export type EpicConnectResponse = z.infer<typeof epicConnectResponseSchema>;
export type IgdbSearchValues = z.infer<typeof igdbSearchRequestSchema>;
export type IgdbSearchResponse = z.infer<typeof igdbSearchResponseSchema>;
