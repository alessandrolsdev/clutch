import type {
  Platform,
  PlatformIntegrationDataSource,
  PlatformIntegrationStatus,
} from '@prisma/client';

export type ProviderCapability =
  | 'SOCIAL_LOGIN'
  | 'CONNECTED_ACCOUNT'
  | 'OAUTH_CONNECT'
  | 'TOKEN_CONNECT'
  | 'LIBRARY_IMPORT'
  | 'PRESENCE_INGESTION';

export type ProviderDefinition = {
  provider: Platform;
  displayName: string;
  dataSource: PlatformIntegrationDataSource;
  status: PlatformIntegrationStatus;
  capabilities: ProviderCapability[];
};

const PROVIDER_DEFINITIONS: readonly ProviderDefinition[] = [
  {
    provider: 'GOOGLE',
    displayName: 'Google',
    dataSource: 'OFFICIAL',
    status: 'CONNECTED',
    capabilities: ['SOCIAL_LOGIN', 'OAUTH_CONNECT'],
  },
  {
    provider: 'DISCORD',
    displayName: 'Discord',
    dataSource: 'OFFICIAL',
    status: 'CONNECTED',
    capabilities: ['SOCIAL_LOGIN', 'CONNECTED_ACCOUNT', 'OAUTH_CONNECT', 'PRESENCE_INGESTION'],
  },
  {
    provider: 'STEAM',
    displayName: 'Steam',
    dataSource: 'OFFICIAL',
    status: 'CONNECTED',
    capabilities: ['CONNECTED_ACCOUNT', 'LIBRARY_IMPORT'],
  },
  {
    provider: 'EPIC',
    displayName: 'Epic Games',
    dataSource: 'EXPERIMENTAL',
    status: 'EXPERIMENTAL',
    capabilities: ['CONNECTED_ACCOUNT', 'TOKEN_CONNECT', 'LIBRARY_IMPORT'],
  },
  {
    provider: 'MYANIMELIST',
    displayName: 'MyAnimeList',
    dataSource: 'OFFICIAL',
    status: 'UNAVAILABLE',
    capabilities: ['CONNECTED_ACCOUNT', 'OAUTH_CONNECT'],
  },
  {
    provider: 'ANILIST',
    displayName: 'AniList',
    dataSource: 'OFFICIAL',
    status: 'UNAVAILABLE',
    capabilities: ['CONNECTED_ACCOUNT', 'OAUTH_CONNECT'],
  },
  {
    provider: 'XBOX',
    displayName: 'Xbox',
    dataSource: 'OFFICIAL',
    status: 'UNAVAILABLE',
    capabilities: ['CONNECTED_ACCOUNT', 'OAUTH_CONNECT'],
  },
  {
    provider: 'PSN',
    displayName: 'PlayStation Network',
    dataSource: 'OFFICIAL',
    status: 'UNAVAILABLE',
    capabilities: ['CONNECTED_ACCOUNT', 'OAUTH_CONNECT'],
  },
  {
    provider: 'RIOT',
    displayName: 'Riot Games',
    dataSource: 'OFFICIAL',
    status: 'UNAVAILABLE',
    capabilities: ['CONNECTED_ACCOUNT', 'OAUTH_CONNECT'],
  },
];

export function listProviderDefinitions(): ProviderDefinition[] {
  return PROVIDER_DEFINITIONS.map((definition) => ({
    ...definition,
    capabilities: [...definition.capabilities],
  }));
}

export function getProviderDefinition(provider: Platform): ProviderDefinition {
  const definition = PROVIDER_DEFINITIONS.find((candidate) => candidate.provider === provider);

  if (!definition) {
    throw new Error(`Provider ${provider} não está registrado.`);
  }

  return {
    ...definition,
    capabilities: [...definition.capabilities],
  };
}
