/* eslint-disable no-unused-vars */
import axios from 'axios';
import {
  createIntegrationError,
  translateUpstreamError,
} from '../integration.errors';

const MYANIMELIST_API_BASE_URL = 'https://api.myanimelist.net/v2';
const MYANIMELIST_LIST_TIMEOUT_MS = 10_000;
const MYANIMELIST_LIST_LIMIT = 50;
const MYANIMELIST_LIST_FIELDS = 'list_status,main_picture';

export type MyAnimeListMediaKind = 'ANIME' | 'MANGA';

export type MyAnimeListListStatus =
  | 'watching'
  | 'reading'
  | 'completed'
  | 'on_hold'
  | 'dropped'
  | 'plan_to_watch'
  | 'plan_to_read';

export type MyAnimeListListItem = {
  id: string;
  title: string;
  kind: MyAnimeListMediaKind;
  coverUrl: string | null;
  status: MyAnimeListListStatus;
  progress: number | null;
  score: number | null;
};

type MyAnimeListApiNode = {
  id?: number | string;
  title?: string;
  main_picture?: {
    medium?: string;
    large?: string;
  };
};

type MyAnimeListApiListStatus = {
  status?: string;
  score?: number;
  num_episodes_watched?: number;
  num_chapters_read?: number;
};

type MyAnimeListApiListEntry = {
  node?: MyAnimeListApiNode;
  list_status?: MyAnimeListApiListStatus;
};

type MyAnimeListListResponse = {
  data?: MyAnimeListApiListEntry[];
  paging?: {
    next?: string;
  };
};

export type MyAnimeListListClient = {
  fetchAnimeList(accessToken: string): Promise<MyAnimeListListItem[]>;
  fetchMangaList(accessToken: string): Promise<MyAnimeListListItem[]>;
};

function normalizeExternalId(value: MyAnimeListApiNode['id']): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return null;
}

function normalizeTitle(value: MyAnimeListApiNode['title']): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeStatus(value: MyAnimeListApiListStatus['status']): MyAnimeListListStatus | null {
  const allowedStatuses = new Set<MyAnimeListListStatus>([
    'watching',
    'reading',
    'completed',
    'on_hold',
    'dropped',
    'plan_to_watch',
    'plan_to_read',
  ]);

  return typeof value === 'string' && allowedStatuses.has(value as MyAnimeListListStatus)
    ? value as MyAnimeListListStatus
    : null;
}

function normalizeOptionalNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function normalizeListEntry(entry: MyAnimeListApiListEntry, kind: MyAnimeListMediaKind): MyAnimeListListItem | null {
  const externalId = normalizeExternalId(entry.node?.id);
  const title = normalizeTitle(entry.node?.title);
  const status = normalizeStatus(entry.list_status?.status);

  if (!externalId || !title || !status) {
    return null;
  }

  return {
    id: externalId,
    title,
    kind,
    coverUrl: entry.node?.main_picture?.large ?? entry.node?.main_picture?.medium ?? null,
    status,
    progress: kind === 'ANIME'
      ? normalizeOptionalNonNegativeInteger(entry.list_status?.num_episodes_watched)
      : normalizeOptionalNonNegativeInteger(entry.list_status?.num_chapters_read),
    score: normalizeOptionalNonNegativeInteger(entry.list_status?.score),
  };
}

async function fetchList(
  accessToken: string,
  kind: MyAnimeListMediaKind,
): Promise<MyAnimeListListItem[]> {
  const path = kind === 'ANIME' ? 'animelist' : 'mangalist';

  try {
    const response = await axios.get<MyAnimeListListResponse>(
      `${MYANIMELIST_API_BASE_URL}/users/@me/${path}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          fields: MYANIMELIST_LIST_FIELDS,
          limit: MYANIMELIST_LIST_LIMIT,
          offset: 0,
        },
        timeout: MYANIMELIST_LIST_TIMEOUT_MS,
      },
    );

    return (response.data.data ?? [])
      .map((entry) => normalizeListEntry(entry, kind))
      .filter((entry): entry is MyAnimeListListItem => entry !== null);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof (error as { response?: { status?: number } }).response?.status === 'number' &&
      [401, 403].includes((error as { response?: { status?: number } }).response?.status as number)
    ) {
      throw createIntegrationError(
        'myanimelist',
        401,
        'invalid_credentials',
        'MyAnimeList precisa ser reconectado antes da importação.',
      );
    }

    throw translateUpstreamError(
      'myanimelist',
      error,
      'Listas MyAnimeList indisponíveis no momento.',
      { targetUrl: `${MYANIMELIST_API_BASE_URL}/users/@me/${path}` },
    );
  }
}

export const myAnimeListListClient: MyAnimeListListClient = {
  fetchAnimeList(accessToken: string): Promise<MyAnimeListListItem[]> {
    return fetchList(accessToken, 'ANIME');
  },

  fetchMangaList(accessToken: string): Promise<MyAnimeListListItem[]> {
    return fetchList(accessToken, 'MANGA');
  },
};
