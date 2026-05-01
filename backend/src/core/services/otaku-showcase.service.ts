import { prisma } from '../../infra/database/client';

export const OTAKU_SHOWCASE_MAX_FEATURED = 3;

export interface OtakuShowcaseItem {
  id: string;
  kind: 'ANIME' | 'MANGA';
  title: string;
  coverUrl: string | null;
}

export interface OtakuShowcaseSummary {
  featured: OtakuShowcaseItem[];
  consumingNow: OtakuShowcaseItem[];
  consumingCount: number;
  completedCount: number;
}

export interface OtakuLibraryEntry {
  id: string;
  kind: 'ANIME' | 'MANGA';
  title: string;
  coverUrl: string | null;
  status: 'PLANNING' | 'CONSUMING' | 'COMPLETED' | 'PAUSED' | 'DROPPED';
  progress: number | null;
  score: number | null;
  showcaseRank: number | null;
  updatedAt: Date;
}

export type OtakuShowcaseServiceErrorCode =
  | 'OTAKU_ENTRY_NOT_FOUND'
  | 'OTAKU_SHOWCASE_LIMIT_EXCEEDED'
  | 'OTAKU_SHOWCASE_RANK_INVALID';

export class OtakuShowcaseServiceError extends Error {
  readonly code: OtakuShowcaseServiceErrorCode;

  constructor(code: OtakuShowcaseServiceErrorCode, message: string) {
    super(message);
    this.name = 'OtakuShowcaseServiceError';
    this.code = code;
  }
}

type PublicShowcaseEntry = {
  showcaseRank: number | null;
  status: 'PLANNING' | 'CONSUMING' | 'COMPLETED' | 'PAUSED' | 'DROPPED';
  mediaTitle: {
    id: string;
    kind: 'ANIME' | 'MANGA';
    canonicalTitle: string;
    coverUrl: string | null;
  };
};

type UserLibraryEntryRecord = {
  id: string;
  status: 'PLANNING' | 'CONSUMING' | 'COMPLETED' | 'PAUSED' | 'DROPPED';
  progress: number | null;
  score: number | null;
  showcaseRank: number | null;
  updatedAt: Date;
  mediaTitle: {
    kind: 'ANIME' | 'MANGA';
    canonicalTitle: string;
    coverUrl: string | null;
  };
};

function compareShowcaseEntries(left: PublicShowcaseEntry, right: PublicShowcaseEntry): number {
  const leftRank = left.showcaseRank ?? Number.MAX_SAFE_INTEGER;
  const rightRank = right.showcaseRank ?? Number.MAX_SAFE_INTEGER;

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return left.mediaTitle.canonicalTitle.localeCompare(right.mediaTitle.canonicalTitle, 'pt-BR');
}

function toShowcaseItem(entry: PublicShowcaseEntry): OtakuShowcaseItem {
  return {
    id: entry.mediaTitle.id,
    kind: entry.mediaTitle.kind,
    title: entry.mediaTitle.canonicalTitle,
    coverUrl: entry.mediaTitle.coverUrl,
  };
}

function toLibraryEntry(entry: UserLibraryEntryRecord): OtakuLibraryEntry {
  return {
    id: entry.id,
    kind: entry.mediaTitle.kind,
    title: entry.mediaTitle.canonicalTitle,
    coverUrl: entry.mediaTitle.coverUrl,
    status: entry.status,
    progress: entry.progress,
    score: entry.score,
    showcaseRank: entry.showcaseRank,
    updatedAt: entry.updatedAt,
  };
}

export const otakuShowcaseService = {
  async listUserLibrary(userId: string): Promise<OtakuLibraryEntry[]> {
    const entries = (await prisma.userMediaEntry.findMany({
      where: {
        userId,
      },
      orderBy: [
        { showcaseRank: 'asc' },
        { updatedAt: 'desc' },
      ],
      select: {
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
      },
    })) as UserLibraryEntryRecord[];

    return entries.map(toLibraryEntry);
  },

  async updateEntryShowcase(
    userId: string,
    entryId: string,
    showcaseRank: number | null,
  ): Promise<OtakuLibraryEntry> {
    if (
      showcaseRank !== null &&
      (!Number.isInteger(showcaseRank) ||
        showcaseRank < 1 ||
        showcaseRank > OTAKU_SHOWCASE_MAX_FEATURED)
    ) {
      throw new OtakuShowcaseServiceError(
        'OTAKU_SHOWCASE_RANK_INVALID',
        `Escolha uma posição de destaque entre 1 e ${OTAKU_SHOWCASE_MAX_FEATURED}.`,
      );
    }

    const existingEntry = await prisma.userMediaEntry.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        userId: true,
        showcaseRank: true,
      },
    });

    if (!existingEntry || existingEntry.userId !== userId) {
      throw new OtakuShowcaseServiceError(
        'OTAKU_ENTRY_NOT_FOUND',
        'Item otaku não encontrado.',
      );
    }

    if (showcaseRank !== null && existingEntry.showcaseRank === null) {
      const currentShowcaseCount = await prisma.userMediaEntry.count({
        where: {
          userId,
          showcaseRank: {
            not: null,
          },
        },
      });

      if (currentShowcaseCount >= OTAKU_SHOWCASE_MAX_FEATURED) {
        throw new OtakuShowcaseServiceError(
          'OTAKU_SHOWCASE_LIMIT_EXCEEDED',
          `O showcase otaku aceita no máximo ${OTAKU_SHOWCASE_MAX_FEATURED} itens.`,
        );
      }
    }

    const updatedEntry = (await prisma.userMediaEntry.update({
      where: { id: entryId },
      data: { showcaseRank },
      select: {
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
      },
    })) as UserLibraryEntryRecord;

    return toLibraryEntry(updatedEntry);
  },

  async summarizeUser(userId: string): Promise<OtakuShowcaseSummary | null> {
    const publicEntries = (await prisma.userMediaEntry.findMany({
      where: {
        userId,
        showcaseRank: {
          not: null,
        },
      },
      select: {
        showcaseRank: true,
        status: true,
        mediaTitle: {
          select: {
            id: true,
            kind: true,
            canonicalTitle: true,
            coverUrl: true,
          },
        },
      },
    })) as PublicShowcaseEntry[];

    if (publicEntries.length === 0) {
      return null;
    }

    publicEntries.sort(compareShowcaseEntries);

    return {
      featured: publicEntries.slice(0, 3).map(toShowcaseItem),
      consumingNow: publicEntries
        .filter((entry) => entry.status === 'CONSUMING')
        .slice(0, 2)
        .map(toShowcaseItem),
      consumingCount: publicEntries.filter((entry) => entry.status === 'CONSUMING').length,
      completedCount: publicEntries.filter((entry) => entry.status === 'COMPLETED').length,
    };
  },
};
