import { prisma } from '../../infra/database/client';

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

export const otakuShowcaseService = {
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
