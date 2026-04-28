import { describe, expect, it } from 'vitest';
import {
  buildExperimentalEpicExternalId,
  buildLegacyEpicExternalId,
  isLegacyEpicExternalId,
} from '@/core/providers/epic-identity';

describe('epic identity helpers', () => {
  it('marca identidades Epic legadas como fallback por usuario', () => {
    const externalId = buildLegacyEpicExternalId('user-id-1');

    expect(externalId).toBe('legacy:epic:user-id-1');
    expect(isLegacyEpicExternalId(externalId)).toBe(true);
    expect(isLegacyEpicExternalId('epic')).toBe(false);
  });

  it('gera identificador experimental deterministico sem manter token bruto', () => {
    const firstExternalId = buildExperimentalEpicExternalId('valid-token');
    const secondExternalId = buildExperimentalEpicExternalId('valid-token');

    expect(firstExternalId).toBe(secondExternalId);
    expect(firstExternalId).toMatch(/^epic:[a-f0-9]{64}$/u);
    expect(firstExternalId).not.toContain('valid-token');
  });
});
