import type { Metadata } from 'next';
import type { ProfileResponse } from '@/schemas/profile';
import { buildPublicAppUrl } from '@/services/http/client';
import { fetchPublicProfileForShare } from '@/lib/profile/public-profile-share';

const LIBRARY_SHARE_DESCRIPTION_MAX_LENGTH = 160;

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : null;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function formatCount(
  count: number,
  singularLabel: string,
  pluralLabel: string,
): string {
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? singularLabel : pluralLabel}`;
}

function normalizeImageUrl(imageUrl: string | null | undefined): string | null {
  const normalized = normalizeText(imageUrl);

  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized, buildPublicAppUrl('/')).toString();
  } catch {
    return null;
  }
}

function resolveTimestamp(value: string | null): number {
  if (!value) {
    return 0;
  }

  const parsedValue = new Date(value).getTime();

  return Number.isNaN(parsedValue) ? 0 : parsedValue;
}

function resolvePrimaryLibraryGame(
  profile: ProfileResponse | null,
): ProfileResponse['gameLibrary'][number] | null {
  if (!profile || profile.gameLibrary.length === 0) {
    return null;
  }

  const sortedGames = [...profile.gameLibrary].sort((left, right) => {
    const hoursDifference = (right.hoursPlayed ?? -1) - (left.hoursPlayed ?? -1);

    if (hoursDifference !== 0) {
      return hoursDifference;
    }

    const recentDifference = resolveTimestamp(right.lastPlayedAt) - resolveTimestamp(left.lastPlayedAt);

    if (recentDifference !== 0) {
      return recentDifference;
    }

    return left.gameName.localeCompare(right.gameName, 'pt-BR');
  });

  return sortedGames[0] ?? null;
}

function resolveTrackedHours(profile: ProfileResponse | null): number | null {
  if (!profile) {
    return null;
  }

  const trackedHours = profile.gameLibrary.reduce((sum, game) => {
    if (typeof game.hoursPlayed !== 'number' || !Number.isFinite(game.hoursPlayed)) {
      return sum;
    }

    return sum + game.hoursPlayed;
  }, 0);

  const hasTrackedHours = profile.gameLibrary.some((game) => {
    return typeof game.hoursPlayed === 'number' && Number.isFinite(game.hoursPlayed);
  });

  if (!hasTrackedHours) {
    return null;
  }

  return Math.max(0, Math.round(trackedHours));
}

function resolveLibraryPlatformCount(profile: ProfileResponse | null): number {
  if (!profile) {
    return 0;
  }

  return new Set(profile.gameLibrary.map((game) => game.platform)).size;
}

function resolveLibraryImageCandidates(profile: ProfileResponse | null): string[] {
  const primaryGame = resolvePrimaryLibraryGame(profile);

  return [
    normalizeImageUrl(primaryGame?.coverUrl),
    normalizeImageUrl(profile?.profile.bannerUrl),
    normalizeImageUrl(profile?.profile.avatarUrl),
  ].filter((value, index, collection): value is string => {
    return value !== null && collection.indexOf(value) === index;
  });
}

export async function fetchPublicLibraryForShare(
  username: string,
): Promise<ProfileResponse | null> {
  return fetchPublicProfileForShare(username);
}

export function buildPublicLibraryCanonicalUrl(username: string): string {
  return buildPublicAppUrl(`/${encodeURIComponent(username)}/library`);
}

export function buildPublicLibraryTitle(
  username: string,
  profile: ProfileResponse | null,
): string {
  const displayName = normalizeText(profile?.profile.displayName);

  if (
    displayName &&
    displayName.toLocaleLowerCase('pt-BR') !== username.toLocaleLowerCase('pt-BR')
  ) {
    return `Biblioteca de ${displayName} (@${username}) | CLUTCH`;
  }

  return `Biblioteca de @${username} | CLUTCH`;
}

export function buildPublicLibraryDescription(
  username: string,
  profile: ProfileResponse | null,
): string {
  const prefix = `Explore a biblioteca publica de @${username} no CLUTCH`;

  if (!profile || profile.gameLibrary.length === 0) {
    return `${prefix}.`;
  }

  const descriptionParts: string[] = [];
  const trackedHours = resolveTrackedHours(profile);
  const platformCount = resolveLibraryPlatformCount(profile);
  const primaryGame = resolvePrimaryLibraryGame(profile);

  descriptionParts.push(
    formatCount(profile.gameLibrary.length, 'jogo', 'jogos'),
  );

  if (trackedHours !== null && trackedHours > 0) {
    descriptionParts.push(`${trackedHours.toLocaleString('pt-BR')}h registradas`);
  }

  if (platformCount > 0) {
    descriptionParts.push(
      formatCount(platformCount, 'plataforma', 'plataformas'),
    );
  }

  if (primaryGame) {
    descriptionParts.push(`destaque para ${primaryGame.gameName}`);
  }

  return truncateText(
    `${prefix} com ${descriptionParts.join(', ')}.`,
    LIBRARY_SHARE_DESCRIPTION_MAX_LENGTH,
  );
}

export function buildPublicLibraryMetadata(
  username: string,
  profile: ProfileResponse | null,
): Metadata {
  const title = buildPublicLibraryTitle(username, profile);
  const description = buildPublicLibraryDescription(username, profile);
  const canonicalUrl = buildPublicLibraryCanonicalUrl(username);
  const imageCandidates = resolveLibraryImageCandidates(profile);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'CLUTCH',
      images:
        imageCandidates.length > 0
          ? imageCandidates.map((url) => ({
              url,
              alt: title,
            }))
          : undefined,
    },
    twitter: {
      card: imageCandidates.length > 0 ? 'summary_large_image' : 'summary',
      title,
      description,
      images: imageCandidates.length > 0 ? imageCandidates : undefined,
    },
  };
}
