import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchOtakuLibrary,
  OtakuRequestError,
  updateOtakuShowcaseEntry,
} from '@/services/otaku';
import { apiRequest } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
}));

const mockedApiRequest = vi.mocked(apiRequest);

function createJsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  } as Response;
}

describe('otaku service', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('lista biblioteca otaku segura', async () => {
    mockedApiRequest.mockResolvedValue(createJsonResponse(200, {
      maxShowcaseItems: 3,
      entries: [
        {
          id: 'entry-1',
          kind: 'ANIME',
          title: 'Sousou no Frieren',
          coverUrl: null,
          status: 'CONSUMING',
          progress: 4,
          score: 9,
          showcaseRank: null,
          updatedAt: '2026-04-30T18:00:00.000Z',
        },
      ],
    }));

    await expect(fetchOtakuLibrary()).resolves.toMatchObject({
      maxShowcaseItems: 3,
      entries: [
        {
          id: 'entry-1',
          title: 'Sousou no Frieren',
        },
      ],
    });
    expect(mockedApiRequest).toHaveBeenCalledWith('/otaku/library', {
      method: 'GET',
    });
  });

  it('atualiza showcaseRank de item otaku', async () => {
    mockedApiRequest.mockResolvedValue(createJsonResponse(200, {
      entry: {
        id: 'entry-1',
        kind: 'MANGA',
        title: 'Berserk',
        coverUrl: null,
        status: 'COMPLETED',
        progress: 12,
        score: null,
        showcaseRank: 1,
        updatedAt: '2026-04-30T18:00:00.000Z',
      },
    }));

    await expect(updateOtakuShowcaseEntry('entry-1', { showcaseRank: 1 }))
      .resolves.toMatchObject({
        entry: {
          id: 'entry-1',
          showcaseRank: 1,
        },
      });
    expect(mockedApiRequest).toHaveBeenCalledWith('/otaku/library/entry-1/showcase', {
      method: 'PATCH',
      body: { showcaseRank: 1 },
    });
  });

  it('mapeia erro do backend sem depender de payload sensivel', async () => {
    mockedApiRequest.mockResolvedValue(createJsonResponse(409, {
      message: 'O showcase otaku aceita no máximo 3 itens.',
      externalId: 'mal-123',
      metadata: { raw: true },
    }));

    const result = updateOtakuShowcaseEntry('entry-1', { showcaseRank: 1 });

    await expect(result).rejects.toBeInstanceOf(OtakuRequestError);
    await expect(result).rejects.toMatchObject({
      status: 409,
      message: 'O showcase otaku aceita no máximo 3 itens.',
    });
  });
});
