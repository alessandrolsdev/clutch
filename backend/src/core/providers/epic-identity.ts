import { createHash } from 'node:crypto';

const LEGACY_EPIC_EXTERNAL_ID_PREFIX = 'legacy:epic:';
const EXPERIMENTAL_EPIC_EXTERNAL_ID_PREFIX = 'epic:';

export function buildLegacyEpicExternalId(userId: string): string {
  return `${LEGACY_EPIC_EXTERNAL_ID_PREFIX}${userId}`;
}

export function isLegacyEpicExternalId(externalId: string): boolean {
  return externalId.startsWith(LEGACY_EPIC_EXTERNAL_ID_PREFIX);
}

export function buildExperimentalEpicExternalId(authToken: string): string {
  return `${EXPERIMENTAL_EPIC_EXTERNAL_ID_PREFIX}${createHash('sha256').update(authToken).digest('hex')}`;
}
