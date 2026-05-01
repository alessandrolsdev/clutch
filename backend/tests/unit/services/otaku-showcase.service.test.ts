import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  otakuShowcaseService,
  OtakuShowcaseServiceError,
} from '@/core/services/otaku-showcase.service';

vi.mock('@/infra/database/client', () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
    userMediaEntry: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
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
    expect(prisma.userMediaEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: 'user-1',
        showcaseRank: {
          not: null,
        },
      },
      select: expect.objectContaining({
        mediaTitle: {
          select: {
            id: true,
            kind: true,
            canonicalTitle: true,
            coverUrl: true,
          },
        },
      }),
    }));
    expect(JSON.stringify(vi.mocked(prisma.userMediaEntry.findMany).mock.calls)).not.toContain('externalId');
    expect(JSON.stringify(vi.mocked(prisma.userMediaEntry.findMany).mock.calls)).not.toContain('metadata');
  });

  it('retorna null quando o usuario nao tem entradas publicas no showcase', async () => {
    vi.mocked(prisma.userMediaEntry.findMany).mockResolvedValue([] as never);

    const summary = await otakuShowcaseService.summarizeUser('user-1');

    expect(summary).toBeNull();
  });

  it('lista biblioteca otaku privada do usuario sem identidade externa bruta', async () => {
    vi.mocked(prisma.userMediaEntry.findMany).mockResolvedValue([
      {
        id: 'entry-1',
        status: 'CONSUMING',
        progress: 4,
        score: 9,
        showcaseRank: null,
        updatedAt: new Date('2026-04-30T18:00:00.000Z'),
        mediaTitle: {
          kind: 'ANIME',
          canonicalTitle: 'Sousou no Frieren',
          coverUrl: 'https://cdn.clutch.gg/frieren.jpg',
        },
      },
    ] as never);

    const entries = await otakuShowcaseService.listUserLibrary('user-1');

    expect(entries).toEqual([
      {
        id: 'entry-1',
        kind: 'ANIME',
        title: 'Sousou no Frieren',
        coverUrl: 'https://cdn.clutch.gg/frieren.jpg',
        status: 'CONSUMING',
        progress: 4,
        score: 9,
        showcaseRank: null,
        updatedAt: new Date('2026-04-30T18:00:00.000Z'),
      },
    ]);
    expect(prisma.userMediaEntry.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: [
        { showcaseRank: 'asc' },
        { updatedAt: 'desc' },
      ],
      select: expect.objectContaining({
        id: true,
        status: true,
        progress: true,
        score: true,
        showcaseRank: true,
        updatedAt: true,
        mediaTitle: {
          select: {
            kind: true,
            canonicalTitle: true,
            coverUrl: true,
          },
        },
      }),
    });
    expect(JSON.stringify(vi.mocked(prisma.userMediaEntry.findMany).mock.calls)).not.toContain('externalId');
  });

  it('define showcaseRank em entrada propria respeitando limite de destaques', async () => {
    vi.mocked(prisma.userMediaEntry.findUnique).mockResolvedValue({
      id: 'entry-1',
      userId: 'user-1',
      showcaseRank: null,
    } as never);
    vi.mocked(prisma.userMediaEntry.count).mockResolvedValue(2);
    vi.mocked(prisma.userMediaEntry.update).mockResolvedValue({
      id: 'entry-1',
      status: 'COMPLETED',
      progress: 12,
      score: 8,
      showcaseRank: 3,
      updatedAt: new Date('2026-04-30T18:00:00.000Z'),
      mediaTitle: {
        kind: 'MANGA',
        canonicalTitle: 'Berserk',
        coverUrl: null,
      },
    } as never);

    const entry = await otakuShowcaseService.updateEntryShowcase('user-1', 'entry-1', 3);

    expect(prisma.userMediaEntry.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        showcaseRank: {
          not: null,
        },
      },
    });
    expect(prisma.userMediaEntry.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        showcaseRank: 3,
        id: {
          not: 'entry-1',
        },
      },
      data: {
        showcaseRank: null,
      },
    });
    expect(prisma.userMediaEntry.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'entry-1' },
      data: { showcaseRank: 3 },
    }));
    expect(entry).toMatchObject({
      id: 'entry-1',
      title: 'Berserk',
      showcaseRank: 3,
    });
  });

  it('remove destaque sem apagar entrada importada', async () => {
    vi.mocked(prisma.userMediaEntry.findUnique).mockResolvedValue({
      id: 'entry-1',
      userId: 'user-1',
      showcaseRank: 1,
    } as never);
    vi.mocked(prisma.userMediaEntry.update).mockResolvedValue({
      id: 'entry-1',
      status: 'CONSUMING',
      progress: 4,
      score: null,
      showcaseRank: null,
      updatedAt: new Date('2026-04-30T18:00:00.000Z'),
      mediaTitle: {
        kind: 'ANIME',
        canonicalTitle: 'Dungeon Meshi',
        coverUrl: null,
      },
    } as never);

    const entry = await otakuShowcaseService.updateEntryShowcase('user-1', 'entry-1', null);

    expect(prisma.userMediaEntry.count).not.toHaveBeenCalled();
    expect(prisma.userMediaEntry.updateMany).not.toHaveBeenCalled();
    expect(prisma.userMediaEntry.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { showcaseRank: null },
    }));
    expect(entry.showcaseRank).toBeNull();
  });

  it('bloqueia alteracao de entrada inexistente ou de outro usuario', async () => {
    vi.mocked(prisma.userMediaEntry.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'entry-2',
        userId: 'other-user',
        showcaseRank: null,
      } as never);

    await expect(otakuShowcaseService.updateEntryShowcase('user-1', 'entry-missing', 1))
      .rejects.toBeInstanceOf(OtakuShowcaseServiceError);
    await expect(otakuShowcaseService.updateEntryShowcase('user-1', 'entry-2', 1))
      .rejects.toMatchObject({
        code: 'OTAKU_ENTRY_NOT_FOUND',
      });
    expect(prisma.userMediaEntry.update).not.toHaveBeenCalled();
  });

  it('normaliza rank duplicado removendo destaque anterior da mesma posicao', async () => {
    vi.mocked(prisma.userMediaEntry.findUnique).mockResolvedValue({
      id: 'entry-2',
      userId: 'user-1',
      showcaseRank: 2,
    } as never);
    vi.mocked(prisma.userMediaEntry.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.userMediaEntry.update).mockResolvedValue({
      id: 'entry-2',
      status: 'COMPLETED',
      progress: 12,
      score: 8,
      showcaseRank: 1,
      updatedAt: new Date('2026-04-30T18:00:00.000Z'),
      mediaTitle: {
        kind: 'MANGA',
        canonicalTitle: 'Berserk',
        coverUrl: null,
      },
    } as never);

    const entry = await otakuShowcaseService.updateEntryShowcase('user-1', 'entry-2', 1);

    expect(prisma.userMediaEntry.count).not.toHaveBeenCalled();
    expect(prisma.userMediaEntry.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        showcaseRank: 1,
        id: {
          not: 'entry-2',
        },
      },
      data: {
        showcaseRank: null,
      },
    });
    expect(entry.showcaseRank).toBe(1);
  });

  it('aplica limite maximo de destaques', async () => {
    vi.mocked(prisma.userMediaEntry.findUnique).mockResolvedValue({
      id: 'entry-4',
      userId: 'user-1',
      showcaseRank: null,
    } as never);
    vi.mocked(prisma.userMediaEntry.count).mockResolvedValue(3);

    await expect(otakuShowcaseService.updateEntryShowcase('user-1', 'entry-4', 1))
      .rejects.toMatchObject({
        code: 'OTAKU_SHOWCASE_LIMIT_EXCEEDED',
      });
    expect(prisma.userMediaEntry.update).not.toHaveBeenCalled();
  });

  it('valida showcaseRank dentro do intervalo publico permitido', async () => {
    await expect(otakuShowcaseService.updateEntryShowcase('user-1', 'entry-1', 4))
      .rejects.toMatchObject({
        code: 'OTAKU_SHOWCASE_RANK_INVALID',
      });
    expect(prisma.userMediaEntry.findUnique).not.toHaveBeenCalled();
  });

  it('rejeita showcaseRank decimal, zero e negativo antes de consultar o banco', async () => {
    await expect(otakuShowcaseService.updateEntryShowcase('user-1', 'entry-1', 1.5))
      .rejects.toMatchObject({
        code: 'OTAKU_SHOWCASE_RANK_INVALID',
      });
    await expect(otakuShowcaseService.updateEntryShowcase('user-1', 'entry-1', 0))
      .rejects.toMatchObject({
        code: 'OTAKU_SHOWCASE_RANK_INVALID',
      });
    await expect(otakuShowcaseService.updateEntryShowcase('user-1', 'entry-1', -1))
      .rejects.toMatchObject({
        code: 'OTAKU_SHOWCASE_RANK_INVALID',
      });
    expect(prisma.userMediaEntry.findUnique).not.toHaveBeenCalled();
  });
});
