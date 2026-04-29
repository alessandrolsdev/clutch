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

export const discordOAuthStartResponseSchema = z.object({
  authorizationUrl: z.string().url(),
});

export const discordOAuthCallbackResponseSchema = z.object({
  message: z.string().min(1),
  platform: z.literal('DISCORD'),
  externalId: z.string().min(1),
  username: z.string().min(1),
  globalName: z.string().nullable(),
});

export const igdbSearchRequestSchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, 'Digite pelo menos 2 caracteres para buscar no IGDB.'),
});

export const igdbSearchGameSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  coverUrl: z.string().nullable(),
  platforms: z.array(z.string()),
  summary: z.string().nullable(),
});

export const igdbSearchResponseSchema = z.object({
  games: z.array(igdbSearchGameSchema),
});

export const connectedAccountProviderSchema = z.enum([
  'GOOGLE',
  'DISCORD',
  'STEAM',
  'EPIC',
  'MYANIMELIST',
  'ANILIST',
  'XBOX',
  'PSN',
  'RIOT',
]);

export const connectedAccountConnectionTypeSchema = z.enum(['SOCIAL_LOGIN', 'CONNECTED_ACCOUNT']);

export const connectedAccountStatusSchema = z.enum([
  'CONNECTED',
  'NEEDS_REAUTH',
  'DISCONNECTED',
  'UNAVAILABLE',
  'EXPERIMENTAL',
]);

export const connectedAccountDataSourceSchema = z.enum([
  'OFFICIAL',
  'MANUAL',
  'EXPERIMENTAL',
  'LOCAL_COMPANION',
]);

export const connectedAccountSchema = z.object({
  provider: connectedAccountProviderSchema,
  displayName: z.string().min(1),
  externalId: z.string().min(1),
  connectionType: connectedAccountConnectionTypeSchema,
  status: connectedAccountStatusSchema,
  dataSource: connectedAccountDataSourceSchema,
  publicProfileVisible: z.boolean(),
  connected: z.boolean(),
  needsReauth: z.boolean(),
  experimental: z.boolean(),
  canUnlink: z.boolean(),
  capabilities: z.array(z.string()),
  lastSyncAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const connectedAccountProviderDefinitionSchema = z.object({
  provider: connectedAccountProviderSchema,
  displayName: z.string().min(1),
  status: connectedAccountStatusSchema,
  dataSource: connectedAccountDataSourceSchema,
  capabilities: z.array(z.string()),
});

export const connectedAccountsResponseSchema = z.object({
  accounts: z.array(connectedAccountSchema),
  providers: z.array(connectedAccountProviderDefinitionSchema).default([]),
});

export const accountConnectionStartResponseSchema = z.object({
  provider: connectedAccountProviderSchema,
  authorizationUrl: z.string().url(),
});

export const accountConnectionCallbackResponseSchema = z.object({
  provider: connectedAccountProviderSchema,
  externalId: z.string().min(1),
  status: connectedAccountStatusSchema,
  connectionType: connectedAccountConnectionTypeSchema,
  message: z.string().min(1),
});

export const accountUnlinkResponseSchema = z.object({
  provider: connectedAccountProviderSchema,
  message: z.string().min(1),
});

export const connectedAccountVisibilityUpdateRequestSchema = z.object({
  publicProfileVisible: z.boolean(),
});

export type SteamConnectValues = z.infer<typeof steamConnectRequestSchema>;
export type SteamConnectResponse = z.infer<typeof steamConnectResponseSchema>;
export type SteamSyncResponse = z.infer<typeof steamSyncResponseSchema>;
export type EpicConnectValues = z.infer<typeof epicConnectRequestSchema>;
export type EpicConnectResponse = z.infer<typeof epicConnectResponseSchema>;
export type DiscordOAuthStartResponse = z.infer<typeof discordOAuthStartResponseSchema>;
export type DiscordOAuthCallbackResponse = z.infer<typeof discordOAuthCallbackResponseSchema>;
export type IgdbSearchValues = z.infer<typeof igdbSearchRequestSchema>;
export type IgdbSearchGame = z.infer<typeof igdbSearchGameSchema>;
export type IgdbSearchResponse = z.infer<typeof igdbSearchResponseSchema>;
export type ConnectedAccountProvider = z.infer<typeof connectedAccountProviderSchema>;
export type ConnectedAccount = z.infer<typeof connectedAccountSchema>;
export type ConnectedAccountProviderDefinition = z.infer<typeof connectedAccountProviderDefinitionSchema>;
export type ConnectedAccountsResponse = z.infer<typeof connectedAccountsResponseSchema>;
export type AccountConnectionStartResponse = z.infer<typeof accountConnectionStartResponseSchema>;
export type AccountConnectionCallbackResponse = z.infer<typeof accountConnectionCallbackResponseSchema>;
export type AccountUnlinkResponse = z.infer<typeof accountUnlinkResponseSchema>;
export type ConnectedAccountVisibilityUpdateValues = z.infer<typeof connectedAccountVisibilityUpdateRequestSchema>;
