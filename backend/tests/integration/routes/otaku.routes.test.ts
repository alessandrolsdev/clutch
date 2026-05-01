import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp, generateTestToken } from '../../helpers/build-app';
import {
  OtakuShowcaseServiceError,
} from '@/core/services/otaku-showcase.service';

vi.mock('@/core/services/otaku-showcase.service', () => ({
  OTAKU_SHOWCASE_MAX_FEATURED: 3,
  OtakuShowcaseServiceError: class OtakuShowcaseServiceError extends Error {
    readonly code: string;

    constructor(code: string, message: string) {
      super(message);
      this.name = 'OtakuShowcaseServiceError';
      this.code = code;
    }
  },
  otakuShowcaseService: {
    listUserLibrary: vi.fn(),
    updateEntryShowcase: vi.fn(),
    summarizeUser: vi.fn(),
  },
}));

import { otakuShowcaseService } from '@/core/services/otaku-showcase.service';

const mockEntry = {
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'ANIME' as const,
  title: 'Sousou no Frieren',
  coverUrl: 'https://cdn.clutch.gg/frieren.jpg',
  status: 'CONSUMING' as const,
  progress: 4,
  score: 9,
  showcaseRank: null,
  updatedAt: new Date('2026-04-30T18:00:00.000Z'),
};

describe('Otaku Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /otaku/library', () => {
    it('exige autenticacao', async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: 'GET',
        url: '/otaku/library',
      });

      expect(response.statusCode).toBe(401);
      expect(otakuShowcaseService.listUserLibrary).not.toHaveBeenCalled();
      await app.close();
    });

    it('lista entradas otaku do usuario autenticado sem payload sensivel', async () => {
      vi.mocked(otakuShowcaseService.listUserLibrary).mockResolvedValue([mockEntry]);
      const app = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'GET',
        url: '/otaku/library',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        maxShowcaseItems: 3,
        entries: [
          {
            id: mockEntry.id,
            title: 'Sousou no Frieren',
            showcaseRank: null,
          },
        ],
      });
      expect(JSON.stringify(response.json())).not.toContain('externalId');
      expect(JSON.stringify(response.json())).not.toContain('metadata');
      expect(JSON.stringify(response.json())).not.toContain('raw');
      expect(otakuShowcaseService.listUserLibrary).toHaveBeenCalledWith('user-id-1');
      await app.close();
    });
  });

  describe('PATCH /otaku/library/:entryId/showcase', () => {
    it('exige autenticacao', async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: 'PATCH',
        url: `/otaku/library/${mockEntry.id}/showcase`,
        payload: { showcaseRank: 1 },
      });

      expect(response.statusCode).toBe(401);
      expect(otakuShowcaseService.updateEntryShowcase).not.toHaveBeenCalled();
      await app.close();
    });

    it('atualiza destaque de entrada propria', async () => {
      vi.mocked(otakuShowcaseService.updateEntryShowcase).mockResolvedValue({
        ...mockEntry,
        showcaseRank: 1,
      });
      const app = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'PATCH',
        url: `/otaku/library/${mockEntry.id}/showcase`,
        headers: { Authorization: `Bearer ${token}` },
        payload: { showcaseRank: 1 },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        entry: {
          id: mockEntry.id,
          showcaseRank: 1,
        },
      });
      expect(otakuShowcaseService.updateEntryShowcase).toHaveBeenCalledWith(
        'user-id-1',
        mockEntry.id,
        1,
      );
      await app.close();
    });

    it('remove destaque com showcaseRank null', async () => {
      vi.mocked(otakuShowcaseService.updateEntryShowcase).mockResolvedValue(mockEntry);
      const app = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'PATCH',
        url: `/otaku/library/${mockEntry.id}/showcase`,
        headers: { Authorization: `Bearer ${token}` },
        payload: { showcaseRank: null },
      });

      expect(response.statusCode).toBe(200);
      expect(otakuShowcaseService.updateEntryShowcase).toHaveBeenCalledWith(
        'user-id-1',
        mockEntry.id,
        null,
      );
      await app.close();
    });

    it('retorna erro coerente quando item nao pertence ao usuario', async () => {
      vi.mocked(otakuShowcaseService.updateEntryShowcase).mockRejectedValue(
        new OtakuShowcaseServiceError('OTAKU_ENTRY_NOT_FOUND', 'Item otaku não encontrado.'),
      );
      const app = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'PATCH',
        url: `/otaku/library/${mockEntry.id}/showcase`,
        headers: { Authorization: `Bearer ${token}` },
        payload: { showcaseRank: 1 },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ message: 'Item otaku não encontrado.' });
      await app.close();
    });

    it('bloqueia limite maximo de destaques', async () => {
      vi.mocked(otakuShowcaseService.updateEntryShowcase).mockRejectedValue(
        new OtakuShowcaseServiceError(
          'OTAKU_SHOWCASE_LIMIT_EXCEEDED',
          'O showcase otaku aceita no máximo 3 itens.',
        ),
      );
      const app = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'PATCH',
        url: `/otaku/library/${mockEntry.id}/showcase`,
        headers: { Authorization: `Bearer ${token}` },
        payload: { showcaseRank: 1 },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ message: 'O showcase otaku aceita no máximo 3 itens.' });
      await app.close();
    });

    it.each([
      ['zero', { showcaseRank: 0 }],
      ['negativo', { showcaseRank: -1 }],
      ['decimal', { showcaseRank: 1.5 }],
      ['string', { showcaseRank: '1' }],
      ['acima do limite', { showcaseRank: 4 }],
      ['payload malformado', { rank: 1 }],
    ])('rejeita showcaseRank invalido: %s', async (_caseName, payload) => {
      const app = await buildApp();
      const token = generateTestToken(app, 'user-id-1');

      const response = await app.inject({
        method: 'PATCH',
        url: `/otaku/library/${mockEntry.id}/showcase`,
        headers: { Authorization: `Bearer ${token}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
      expect(otakuShowcaseService.updateEntryShowcase).not.toHaveBeenCalled();
      await app.close();
    });
  });
});
