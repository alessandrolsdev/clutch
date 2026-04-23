import type { Metadata } from 'next';
import { profileResponseSchema, type ProfileResponse } from '@/schemas/profile';
import { buildApiUrl, buildPublicAppUrl } from '@/services/http/client';

const PROFILE_SHARE_DESCRIPTION_MAX_LENGTH = 160;

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

export async function fetchPublicProfileForShare(
  username: string,
): Promise<ProfileResponse | null> {
  try {
    const response = await fetch(
      buildApiUrl(`/profiles/${encodeURIComponent(username)}`),
      {
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const parsedProfile = profileResponseSchema.safeParse(payload);

    return parsedProfile.success ? parsedProfile.data : null;
  } catch {
    return null;
  }
}

export function buildPublicProfileCanonicalUrl(username: string): string {
  return buildPublicAppUrl(`/${encodeURIComponent(username)}`);
}

export function buildPublicProfileTitle(
  username: string,
  profile: ProfileResponse | null,
): string {
  const displayName = normalizeText(profile?.profile.displayName);

  if (displayName && displayName.toLocaleLowerCase('pt-BR') !== username.toLocaleLowerCase('pt-BR')) {
    return `${displayName} (@${username}) | CLUTCH`;
  }

  return `@${username} | CLUTCH`;
}

export function buildPublicProfileDescription(
  username: string,
  profile: ProfileResponse | null,
): string {
  const bio = normalizeText(profile?.profile.bio);

  if (bio) {
    return truncateText(bio, PROFILE_SHARE_DESCRIPTION_MAX_LENGTH);
  }

  const descriptionParts: string[] = [];

  if (profile?.profile.badges.length) {
    descriptionParts.push(formatCount(profile.profile.badges.length, 'badge', 'badges'));
  }

  if (profile?.platformIntegrations.length) {
    descriptionParts.push(
      formatCount(
        profile.platformIntegrations.length,
        'plataforma conectada',
        'plataformas conectadas',
      ),
    );
  }

  if (profile?.gameLibrary.length) {
    descriptionParts.push(
      formatCount(profile.gameLibrary.length, 'jogo na biblioteca', 'jogos na biblioteca'),
    );
  }

  const currentStreakDays = profile?.socialContinuity.currentStreakDays ?? 0;

  if (currentStreakDays > 0) {
    descriptionParts.push(
      `streak atual de ${formatCount(
        currentStreakDays,
        'dia',
        'dias',
      )}`,
    );
  }

  const prefix = `Perfil gamer de @${username} no CLUTCH`;

  if (descriptionParts.length === 0) {
    return prefix;
  }

  return truncateText(
    `${prefix} com ${descriptionParts.join(', ')}.`,
    PROFILE_SHARE_DESCRIPTION_MAX_LENGTH,
  );
}

export function buildPublicProfileMetadata(
  username: string,
  profile: ProfileResponse | null,
): Metadata {
  const title = buildPublicProfileTitle(username, profile);
  const description = buildPublicProfileDescription(username, profile);
  const canonicalUrl = buildPublicProfileCanonicalUrl(username);
  const imageCandidates = [
    normalizeImageUrl(profile?.profile.bannerUrl),
    normalizeImageUrl(profile?.profile.avatarUrl),
  ].filter((value): value is string => value !== null);

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
