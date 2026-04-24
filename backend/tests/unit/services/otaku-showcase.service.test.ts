import { beforeEach, describe, expect, it, vi } from 'vitest';
import { otakuShowcaseService } from '@/core/services/otaku-showcase.service';

vi.mock('@/infra/database/client', () => ({
  prisma: {
    userMediaEntry: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/infra/database/client';

describe('otakuShowcaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resume entradas publicas destacadas em um showcase compacto', async () => {
    vi.mocked(prisma.userMediaEntry.findMany).mockResolvedValue([
      {
        showcaseRank: 2,
        status: 'CONSUMING',
        mediaTitle: {
          id: 'media-2',
          kind: 'MANGA',
          canonicalTitle: 'Blue Lock',
          coverUrl: null,
        },
      },
      {
        showcaseRank: 1,
        status: 'COMPLETED',
        mediaTitle: {
          id: 'media-1',
          kind: 'ANIME',
          canonicalTitle: 'Sousou no Frieren',
          coverUrl: 'https://cdn.clutch.gg/frieren.jpg',
        },
      },
      {
        showcaseRank: 3,
        status: 'CONSUMING',
        mediaTitle: {
          id: 'media-3',
          kind: 'ANIME',
          canonicalTitle: 'Dungeon Meshi',
          coverUrl: 'https://cdn.clutch.gg/dungeon-meshi.jpg',
        },
      },
    ] as never);

    const summary = await otakuShowcaseService.summarizeUser('user-1');

    expect(summary).toEqual({
      featured: [
        {
          id: 'media-1',
          kind: 'ANIME',
          title: 'Sousou no Frieren',
          coverUrl: 'https://cdn.clutch.gg/frieren.jpg',
        },
        {
          id: 'media-2',
          kind: 'MANGA',
          title: 'Blue Lock',
          coverUrl: null,
        },
        {
          id: 'media-3',
          kind: 'ANIME',
          title: 'Dungeon Meshi',
          coverUrl: 'https://cdn.clutch.gg/dungeon-meshi.jpg',
        },
      ],
      consumingNow: [
        {
          id: 'media-2',
          kind: 'MANGA',
          title: 'Blue Lock',
          coverUrl: null,
        },
        {
          id: 'media-3',
          kind: 'ANIME',
          title: 'Dungeon Meshi',
          coverUrl: 'https://cdn.clutch.gg/dungeon-meshi.jpg',
        },
      ],
      consumingCount: 2,
      completedCount: 1,
    });
  });

  it('retorna null quando o usuario nao tem entradas publicas no showcase', async () => {
    vi.mocked(prisma.userMediaEntry.findMany).mockResolvedValue([] as never);

    const summary = await otakuShowcaseService.summarizeUser('user-1');

    expect(summary).toBeNull();
  });
});
