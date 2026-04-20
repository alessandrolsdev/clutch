import { timingSafeEqual } from 'node:crypto';

export const DISCORD_PRESENCE_INGEST_TOKEN_HEADER = 'x-clutch-discord-ingest-token';

function normalizeHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  if (Array.isArray(value)) {
    const [firstValue] = value;
    if (typeof firstValue === 'string') {
      const normalizedValue = firstValue.trim();
      return normalizedValue.length > 0 ? normalizedValue : null;
    }
  }

  return null;
}

export function resolveDiscordPresenceIngestToken(): string | null {
  const configuredToken = process.env['DISCORD_PRESENCE_INGEST_TOKEN']?.trim();
  return configuredToken && configuredToken.length > 0 ? configuredToken : null;
}

export function isDiscordPresenceIngestConfigured(): boolean {
  return resolveDiscordPresenceIngestToken() !== null;
}

export function hasValidDiscordPresenceIngestToken(
  providedToken: string | string[] | undefined,
): boolean {
  const configuredToken = resolveDiscordPresenceIngestToken();
  const normalizedProvidedToken = normalizeHeaderValue(providedToken);

  if (!configuredToken || !normalizedProvidedToken) {
    return false;
  }

  const configuredBuffer = Buffer.from(configuredToken, 'utf8');
  const providedBuffer = Buffer.from(normalizedProvidedToken, 'utf8');

  if (configuredBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(configuredBuffer, providedBuffer);
}
