import bcrypt from 'bcrypt';
import * as prismaClientPackage from '@prisma/client';
import type {
  Prisma,
  PrismaClient as PrismaClientType,
} from '@prisma/client';
import { fileURLToPath } from 'node:url';

const {
  InteractionType,
  NotificationType,
  Platform,
  PostType,
  PresenceStatus,
  Prisma: PrismaRuntime,
  PrismaClient,
} = prismaClientPackage;

type InteractionType = (typeof InteractionType)[keyof typeof InteractionType];
type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];
type Platform = (typeof Platform)[keyof typeof Platform];
type PostType = (typeof PostType)[keyof typeof PostType];
type PresenceStatus = (typeof PresenceStatus)[keyof typeof PresenceStatus];
type PrismaClient = PrismaClientType;

const prisma = new PrismaClient();

const SEED_PASSWORD_ROUNDS = 12;

export const DEMO_ACCOUNT = {
  email: 'clutchplayer@clutch.gg',
  password: 'clutch123',
} as const;

export const SEEDED_USER_EMAILS = seedUsersPlaceholder();
export const SEEDED_ENTITY_IDS = {
  posts: [
    'a1111111-1111-4111-8111-111111111111',
    'a2222222-2222-4222-8222-222222222222',
    'a3333333-3333-4333-8333-333333333333',
    'a4444444-4444-4444-8444-444444444444',
  ],
  comments: [
    'b1111111-1111-4111-8111-111111111111',
    'b2222222-2222-4222-8222-222222222222',
    'b3333333-3333-4333-8333-333333333333',
  ],
  interactions: [
    'c1111111-1111-4111-8111-111111111111',
    'c2222222-2222-4222-8222-222222222222',
  ],
  notifications: [
    'd1111111-1111-4111-8111-111111111111',
    'd2222222-2222-4222-8222-222222222222',
    'd3333333-3333-4333-8333-333333333333',
    'd4444444-4444-4444-8444-444444444444',
  ],
  friendRequests: [
    'e1111111-1111-4111-8111-111111111111',
  ],
  friendships: [
    'f1111111-1111-4111-8111-111111111111',
    'f2222222-2222-4222-8222-222222222222',
    'f3333333-3333-4333-8333-333333333333',
    'f4444444-4444-4444-8444-444444444444',
    'f5555555-5555-4555-8555-555555555555',
    'f6666666-6666-4666-8666-666666666666',
  ],
} as const;

type SeedUserConfig = {
  email: string;
  username: string;
  password: string;
  profile: {
    displayName: string;
    bio: string;
    avatarUrl: string;
    bannerUrl: string;
    accentColor: string;
    badges: string[];
  };
  stats: {
    level: number;
    xp: number;
    reputation: number;
    friendCount: number;
    postCount: number;
  };
  presence: {
    status: PresenceStatus;
    currentGame: string | null;
    platform: string | null;
    gameDetails: Prisma.JsonObject | null;
  };
};

type SeedUserRecord = SeedUserConfig & {
  id?: string;
};

type SeedPostConfig = {
  id: string;
  authorEmail: string;
  contentText: string;
  mediaUrl: string | null;
  type: PostType;
  gameContext: Prisma.JsonObject | null;
  createdAt: Date;
};

type SeedCommentConfig = {
  id: string;
  postId: string;
  authorEmail: string;
  content: string;
  parentId: string | null;
  createdAt: Date;
};

type SeedInteractionConfig = {
  id: string;
  postId: string;
  userEmail: string;
  type: InteractionType;
  createdAt: Date;
};

type SeedNotificationConfig = {
  id: string;
  recipientEmail: string;
  actorEmail: string | null;
  type: NotificationType;
  payload: Prisma.JsonObject;
  isRead: boolean;
  createdAt: Date;
};

type SeedFriendshipConfig = {
  id: string;
  userEmail: string;
  friendEmail: string;
  createdAt: Date;
};

type SeedFriendRequestConfig = {
  id: string;
  senderEmail: string;
  receiverEmail: string;
  createdAt: Date;
};

type SeedLibraryConfig = {
  userEmail: string;
  gameId: string;
  gameName: string;
  coverUrl: string | null;
  platform: Platform;
  hoursPlayed: number | null;
  lastPlayedAt: Date | null;
};

type SeedIntegrationConfig = {
  userEmail: string;
  platform: Platform;
  externalId: string;
  metadata: Prisma.JsonObject;
};

function toNullableJsonInput(value: Prisma.JsonObject | null): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value ?? PrismaRuntime.JsonNull;
}

const seedUsers: SeedUserRecord[] = [
  {
    email: DEMO_ACCOUNT.email,
    username: 'clutchplayer',
    password: DEMO_ACCOUNT.password,
    profile: {
      displayName: 'CLUTCH Player',
      bio: 'Coleciono runs co-op, animes de temporada e qualquer desculpa para grindar ranking com amigos.',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=1600&q=80',
      accentColor: '#7C3AED',
      badges: ['Founder', 'Ranked Grinder', 'Community Host'],
    },
    stats: {
      level: 18,
      xp: 4820,
      reputation: 215,
      friendCount: 2,
      postCount: 2,
    },
    presence: {
      status: PresenceStatus.IN_GAME,
      currentGame: 'Valorant',
      platform: 'PC',
      gameDetails: {
        mode: 'Competitive',
        partySize: 3,
        rank: 'Ascendant',
      },
    },
  },
  {
    email: 'sam@clutch.gg',
    username: 'pixelsamurai',
    password: 'samurai123',
    profile: {
      displayName: 'Pixel Samurai',
      bio: 'Main de fighting game, editor de clipes e responsável por puxar a party quando o lobby trava.',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1600&q=80',
      accentColor: '#06B6D4',
      badges: ['FGC', 'Clip Curator'],
    },
    stats: {
      level: 15,
      xp: 3610,
      reputation: 180,
      friendCount: 2,
      postCount: 1,
    },
    presence: {
      status: PresenceStatus.ONLINE,
      currentGame: null,
      platform: 'PC',
      gameDetails: null,
    },
  },
  {
    email: 'luna@clutch.gg',
    username: 'lunacode',
    password: 'luna123',
    profile: {
      displayName: 'Luna Code',
      bio: 'Otaku, healer de raid e pessoa que sempre traz a build mais absurda do patch.',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1511884642898-4c92249e20b6?auto=format&fit=crop&w=1600&q=80',
      accentColor: '#10B981',
      badges: ['Support Main', 'Seasonal Watcher'],
    },
    stats: {
      level: 14,
      xp: 3390,
      reputation: 172,
      friendCount: 2,
      postCount: 1,
    },
    presence: {
      status: PresenceStatus.AFK,
      currentGame: 'Final Fantasy XIV',
      platform: 'PC',
      gameDetails: {
        duty: 'Abyssos',
        role: 'Healer',
      },
    },
  },
  {
    email: 'neo@clutch.gg',
    username: 'retrobyte',
    password: 'retro123',
    profile: {
      displayName: 'Retro Byte',
      bio: 'Caçador de backlog, speedrunner casual e dono do melhor emulador configurado da guilda.',
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=256&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80',
      accentColor: '#F59E0B',
      badges: ['Retro Collector'],
    },
    stats: {
      level: 9,
      xp: 1440,
      reputation: 88,
      friendCount: 0,
      postCount: 0,
    },
    presence: {
      status: PresenceStatus.OFFLINE,
      currentGame: null,
      platform: null,
      gameDetails: null,
    },
  },
];

const seedPosts: SeedPostConfig[] = [
  {
    id: 'a1111111-1111-4111-8111-111111111111',
    authorEmail: DEMO_ACCOUNT.email,
    contentText: 'Fechamos mais uma ranked limpa hoje. Bora montar squad fixo para o fim de semana?',
    mediaUrl: null,
    type: PostType.GAME_SESSION,
    gameContext: {
      gameName: 'Valorant',
      platform: 'PC',
      capturedAt: '2026-03-29T22:15:00.000Z',
    },
    createdAt: new Date('2026-03-29T22:15:00.000Z'),
  },
  {
    id: 'a2222222-2222-4222-8222-222222222222',
    authorEmail: 'sam@clutch.gg',
    contentText: 'Clip novo no ar. O parry saiu feio, mas a comeback foi cinema.',
    mediaUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
    type: PostType.IMAGE,
    gameContext: null,
    createdAt: new Date('2026-03-29T19:40:00.000Z'),
  },
  {
    id: 'a3333333-3333-4333-8333-333333333333',
    authorEmail: 'luna@clutch.gg',
    contentText: 'Patch notes bons demais. Minha build de support voltou a ser meta.',
    mediaUrl: null,
    type: PostType.TEXT,
    gameContext: {
      gameName: 'Final Fantasy XIV',
      platform: 'PC',
      capturedAt: '2026-03-28T18:20:00.000Z',
    },
    createdAt: new Date('2026-03-28T18:20:00.000Z'),
  },
  {
    id: 'a4444444-4444-4444-8444-444444444444',
    authorEmail: DEMO_ACCOUNT.email,
    contentText: 'Organizando a noite de watch party do anime da temporada. Quem cola?',
    mediaUrl: null,
    type: PostType.TEXT,
    gameContext: null,
    createdAt: new Date('2026-03-27T21:05:00.000Z'),
  },
];

const seedComments: SeedCommentConfig[] = [
  {
    id: 'b1111111-1111-4111-8111-111111111111',
    postId: 'a2222222-2222-4222-8222-222222222222',
    authorEmail: DEMO_ACCOUNT.email,
    content: 'Esse clutch no final ficou absurdo. Quero replay dessa partida.',
    parentId: null,
    createdAt: new Date('2026-03-29T20:05:00.000Z'),
  },
  {
    id: 'b2222222-2222-4222-8222-222222222222',
    postId: 'a2222222-2222-4222-8222-222222222222',
    authorEmail: 'luna@clutch.gg',
    content: 'Já garanti o replay. Depois eu corto a reação do chat também.',
    parentId: 'b1111111-1111-4111-8111-111111111111',
    createdAt: new Date('2026-03-29T20:11:00.000Z'),
  },
  {
    id: 'b3333333-3333-4333-8333-333333333333',
    postId: 'a1111111-1111-4111-8111-111111111111',
    authorEmail: 'sam@clutch.gg',
    content: 'Fechado. Eu entro de controller e a Luna faz o suporte moral do lobby.',
    parentId: null,
    createdAt: new Date('2026-03-29T22:22:00.000Z'),
  },
];

const seedInteractions: SeedInteractionConfig[] = [
  {
    id: 'c1111111-1111-4111-8111-111111111111',
    postId: 'a2222222-2222-4222-8222-222222222222',
    userEmail: DEMO_ACCOUNT.email,
    type: InteractionType.GG,
    createdAt: new Date('2026-03-29T19:45:00.000Z'),
  },
  {
    id: 'c2222222-2222-4222-8222-222222222222',
    postId: 'a1111111-1111-4111-8111-111111111111',
    userEmail: 'luna@clutch.gg',
    type: InteractionType.HYPE,
    createdAt: new Date('2026-03-29T22:18:00.000Z'),
  },
];

const seedNotifications: SeedNotificationConfig[] = [
  {
    id: 'd1111111-1111-4111-8111-111111111111',
    recipientEmail: DEMO_ACCOUNT.email,
    actorEmail: 'neo@clutch.gg',
    type: NotificationType.FRIEND_REQUEST,
    payload: {
      requestId: 'e1111111-1111-4111-8111-111111111111',
      senderId: 'neo',
    },
    isRead: false,
    createdAt: new Date('2026-03-30T09:00:00.000Z'),
  },
  {
    id: 'd2222222-2222-4222-8222-222222222222',
    recipientEmail: DEMO_ACCOUNT.email,
    actorEmail: 'sam@clutch.gg',
    type: NotificationType.POST_COMMENT,
    payload: {
      postId: 'a1111111-1111-4111-8111-111111111111',
      commentId: 'b3333333-3333-4333-8333-333333333333',
      parentId: null,
    },
    isRead: false,
    createdAt: new Date('2026-03-29T22:22:00.000Z'),
  },
  {
    id: 'd3333333-3333-4333-8333-333333333333',
    recipientEmail: DEMO_ACCOUNT.email,
    actorEmail: 'luna@clutch.gg',
    type: NotificationType.POST_LIKE,
    payload: {
      postId: 'a1111111-1111-4111-8111-111111111111',
      interactionType: InteractionType.HYPE,
    },
    isRead: true,
    createdAt: new Date('2026-03-29T22:18:00.000Z'),
  },
  {
    id: 'd4444444-4444-4444-8444-444444444444',
    recipientEmail: 'sam@clutch.gg',
    actorEmail: DEMO_ACCOUNT.email,
    type: NotificationType.FRIEND_ACCEPTED,
    payload: {
      requestId: 'legacy-demo-acceptance',
      friendId: 'clutchplayer',
    },
    isRead: true,
    createdAt: new Date('2026-03-26T18:00:00.000Z'),
  },
];

const seedFriendships: SeedFriendshipConfig[] = [
  {
    id: 'f1111111-1111-4111-8111-111111111111',
    userEmail: DEMO_ACCOUNT.email,
    friendEmail: 'sam@clutch.gg',
    createdAt: new Date('2026-03-26T18:00:00.000Z'),
  },
  {
    id: 'f2222222-2222-4222-8222-222222222222',
    userEmail: 'sam@clutch.gg',
    friendEmail: DEMO_ACCOUNT.email,
    createdAt: new Date('2026-03-26T18:00:00.000Z'),
  },
  {
    id: 'f3333333-3333-4333-8333-333333333333',
    userEmail: DEMO_ACCOUNT.email,
    friendEmail: 'luna@clutch.gg',
    createdAt: new Date('2026-03-27T13:30:00.000Z'),
  },
  {
    id: 'f4444444-4444-4444-8444-444444444444',
    userEmail: 'luna@clutch.gg',
    friendEmail: DEMO_ACCOUNT.email,
    createdAt: new Date('2026-03-27T13:30:00.000Z'),
  },
  {
    id: 'f5555555-5555-4555-8555-555555555555',
    userEmail: 'sam@clutch.gg',
    friendEmail: 'luna@clutch.gg',
    createdAt: new Date('2026-03-28T10:00:00.000Z'),
  },
  {
    id: 'f6666666-6666-4666-8666-666666666666',
    userEmail: 'luna@clutch.gg',
    friendEmail: 'sam@clutch.gg',
    createdAt: new Date('2026-03-28T10:00:00.000Z'),
  },
];

const seedFriendRequests: SeedFriendRequestConfig[] = [
  {
    id: 'e1111111-1111-4111-8111-111111111111',
    senderEmail: 'neo@clutch.gg',
    receiverEmail: DEMO_ACCOUNT.email,
    createdAt: new Date('2026-03-30T09:00:00.000Z'),
  },
];

const seedLibraries: SeedLibraryConfig[] = [
  {
    userEmail: DEMO_ACCOUNT.email,
    gameId: 'valorant-demo',
    gameName: 'Valorant',
    coverUrl: 'https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=600&q=80',
    platform: Platform.STEAM,
    hoursPlayed: 412,
    lastPlayedAt: new Date('2026-03-29T22:15:00.000Z'),
  },
  {
    userEmail: DEMO_ACCOUNT.email,
    gameId: 'ffxiv-demo',
    gameName: 'Final Fantasy XIV',
    coverUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
    platform: Platform.EPIC,
    hoursPlayed: 198,
    lastPlayedAt: new Date('2026-03-28T18:20:00.000Z'),
  },
  {
    userEmail: 'sam@clutch.gg',
    gameId: 'sf6-demo',
    gameName: 'Street Fighter 6',
    coverUrl: 'https://images.unsplash.com/photo-1511884642898-4c92249e20b6?auto=format&fit=crop&w=600&q=80',
    platform: Platform.STEAM,
    hoursPlayed: 265,
    lastPlayedAt: new Date('2026-03-29T19:40:00.000Z'),
  },
];

const seedIntegrations: SeedIntegrationConfig[] = [
  {
    userEmail: DEMO_ACCOUNT.email,
    platform: Platform.STEAM,
    externalId: 'demo-steam-clutchplayer',
    metadata: {
      profileUrl: 'https://steamcommunity.com/id/clutchplayer',
      visibility: 'public-demo',
    },
  },
  {
    userEmail: DEMO_ACCOUNT.email,
    platform: Platform.EPIC,
    externalId: 'demo-epic-clutchplayer',
    metadata: {
      accountName: 'CLUTCHPlayer',
      linkedAt: '2026-03-25T12:00:00.000Z',
    },
  },
  {
    userEmail: 'sam@clutch.gg',
    platform: Platform.STEAM,
    externalId: 'demo-steam-pixelsamurai',
    metadata: {
      profileUrl: 'https://steamcommunity.com/id/pixelsamurai',
      visibility: 'public-demo',
    },
  },
];

function seedUsersPlaceholder(): readonly string[] {
  return [
    DEMO_ACCOUNT.email,
    'sam@clutch.gg',
    'luna@clutch.gg',
    'neo@clutch.gg',
  ] as const;
}

async function upsertUsers(client: PrismaClient): Promise<Map<string, string>> {
  const userIdsByEmail = new Map<string, string>();

  for (const user of seedUsers) {
    const passwordHash = await bcrypt.hash(user.password, SEED_PASSWORD_ROUNDS);
    const savedUser = await client.user.upsert({
      where: { email: user.email },
      update: {
        username: user.username,
        password_hash: passwordHash,
        isActive: true,
      },
      create: {
        username: user.username,
        email: user.email,
        password_hash: passwordHash,
        isActive: true,
      },
    });

    userIdsByEmail.set(user.email, savedUser.id);

    await client.profile.upsert({
      where: { userId: savedUser.id },
      update: {
        displayName: user.profile.displayName,
        bio: user.profile.bio,
        avatarUrl: user.profile.avatarUrl,
        bannerUrl: user.profile.bannerUrl,
        accentColor: user.profile.accentColor,
        badges: user.profile.badges,
      },
      create: {
        userId: savedUser.id,
        displayName: user.profile.displayName,
        bio: user.profile.bio,
        avatarUrl: user.profile.avatarUrl,
        bannerUrl: user.profile.bannerUrl,
        accentColor: user.profile.accentColor,
        badges: user.profile.badges,
      },
    });

    await client.userStats.upsert({
      where: { userId: savedUser.id },
      update: {
        level: user.stats.level,
        xp: user.stats.xp,
        reputation: user.stats.reputation,
        friendCount: user.stats.friendCount,
        postCount: user.stats.postCount,
      },
      create: {
        userId: savedUser.id,
        level: user.stats.level,
        xp: user.stats.xp,
        reputation: user.stats.reputation,
        friendCount: user.stats.friendCount,
        postCount: user.stats.postCount,
      },
    });

    await client.userPresence.upsert({
      where: { userId: savedUser.id },
      update: {
        status: user.presence.status,
        currentGame: user.presence.currentGame,
        platform: user.presence.platform,
        gameDetails: toNullableJsonInput(user.presence.gameDetails),
      },
      create: {
        userId: savedUser.id,
        status: user.presence.status,
        currentGame: user.presence.currentGame,
        platform: user.presence.platform,
        gameDetails: toNullableJsonInput(user.presence.gameDetails),
      },
    });
  }

  return userIdsByEmail;
}

function getUserId(userIdsByEmail: Map<string, string>, email: string): string {
  const userId = userIdsByEmail.get(email);
  if (!userId) {
    throw new Error(`Seed user not found for email: ${email}`);
  }

  return userId;
}

async function upsertSeedRelations(client: PrismaClient, userIdsByEmail: Map<string, string>): Promise<void> {
  for (const integration of seedIntegrations) {
    const userId = getUserId(userIdsByEmail, integration.userEmail);
    await client.platformIntegration.upsert({
      where: {
        userId_platform: {
          userId,
          platform: integration.platform,
        },
      },
      update: {
        externalId: integration.externalId,
        metadata: integration.metadata,
        isActive: true,
        accessToken: null,
        refreshToken: null,
      },
      create: {
        userId,
        platform: integration.platform,
        externalId: integration.externalId,
        metadata: integration.metadata,
        isActive: true,
      },
    });
  }

  for (const game of seedLibraries) {
    const userId = getUserId(userIdsByEmail, game.userEmail);
    await client.userGameLibrary.upsert({
      where: {
        userId_gameId_platform: {
          userId,
          gameId: game.gameId,
          platform: game.platform,
        },
      },
      update: {
        gameName: game.gameName,
        coverUrl: game.coverUrl,
        hoursPlayed: game.hoursPlayed,
        lastPlayedAt: game.lastPlayedAt,
      },
      create: {
        userId,
        gameId: game.gameId,
        gameName: game.gameName,
        coverUrl: game.coverUrl,
        platform: game.platform,
        hoursPlayed: game.hoursPlayed,
        lastPlayedAt: game.lastPlayedAt,
      },
    });
  }

  for (const friendship of seedFriendships) {
    await client.friendship.upsert({
      where: { id: friendship.id },
      update: {
        userId: getUserId(userIdsByEmail, friendship.userEmail),
        friendId: getUserId(userIdsByEmail, friendship.friendEmail),
        createdAt: friendship.createdAt,
      },
      create: {
        id: friendship.id,
        userId: getUserId(userIdsByEmail, friendship.userEmail),
        friendId: getUserId(userIdsByEmail, friendship.friendEmail),
        createdAt: friendship.createdAt,
      },
    });
  }

  for (const request of seedFriendRequests) {
    await client.friendRequest.upsert({
      where: { id: request.id },
      update: {
        senderId: getUserId(userIdsByEmail, request.senderEmail),
        receiverId: getUserId(userIdsByEmail, request.receiverEmail),
        status: 'PENDING',
        createdAt: request.createdAt,
      },
      create: {
        id: request.id,
        senderId: getUserId(userIdsByEmail, request.senderEmail),
        receiverId: getUserId(userIdsByEmail, request.receiverEmail),
        status: 'PENDING',
        createdAt: request.createdAt,
      },
    });
  }

  for (const post of seedPosts) {
    await client.post.upsert({
      where: { id: post.id },
      update: {
        userId: getUserId(userIdsByEmail, post.authorEmail),
        contentText: post.contentText,
        mediaUrl: post.mediaUrl,
        type: post.type,
        gameContext: toNullableJsonInput(post.gameContext),
        createdAt: post.createdAt,
      },
      create: {
        id: post.id,
        userId: getUserId(userIdsByEmail, post.authorEmail),
        contentText: post.contentText,
        mediaUrl: post.mediaUrl,
        type: post.type,
        gameContext: toNullableJsonInput(post.gameContext),
        createdAt: post.createdAt,
      },
    });
  }

  for (const comment of seedComments) {
    await client.comment.upsert({
      where: { id: comment.id },
      update: {
        postId: comment.postId,
        userId: getUserId(userIdsByEmail, comment.authorEmail),
        content: comment.content,
        parentId: comment.parentId,
        createdAt: comment.createdAt,
      },
      create: {
        id: comment.id,
        postId: comment.postId,
        userId: getUserId(userIdsByEmail, comment.authorEmail),
        content: comment.content,
        parentId: comment.parentId,
        createdAt: comment.createdAt,
      },
    });
  }

  for (const interaction of seedInteractions) {
    await client.interaction.upsert({
      where: { id: interaction.id },
      update: {
        postId: interaction.postId,
        userId: getUserId(userIdsByEmail, interaction.userEmail),
        type: interaction.type,
        createdAt: interaction.createdAt,
      },
      create: {
        id: interaction.id,
        postId: interaction.postId,
        userId: getUserId(userIdsByEmail, interaction.userEmail),
        type: interaction.type,
        createdAt: interaction.createdAt,
      },
    });
  }

  for (const notification of seedNotifications) {
    const actorId = notification.actorEmail ? getUserId(userIdsByEmail, notification.actorEmail) : null;
    const resolvedPayload: Prisma.JsonObject = {
      ...notification.payload,
      ...(notification.type === NotificationType.FRIEND_REQUEST
        ? { senderId: actorId }
        : {}),
      ...(notification.type === NotificationType.FRIEND_ACCEPTED
        ? { friendId: actorId }
        : {}),
    };

    await client.notification.upsert({
      where: { id: notification.id },
      update: {
        userId: getUserId(userIdsByEmail, notification.recipientEmail),
        actorId,
        type: notification.type,
        payload: resolvedPayload,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      },
      create: {
        id: notification.id,
        userId: getUserId(userIdsByEmail, notification.recipientEmail),
        actorId,
        type: notification.type,
        payload: resolvedPayload,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      },
    });
  }
}

export async function runSeed(client: PrismaClient = prisma): Promise<void> {
  const userIdsByEmail = await upsertUsers(client);
  await upsertSeedRelations(client, userIdsByEmail);
}

async function main(): Promise<void> {
  await runSeed(prisma);
  console.log('CLUTCH seed concluído com sucesso.');
  console.log(`Conta demo: ${DEMO_ACCOUNT.email} / ${DEMO_ACCOUNT.password}`);
}

const currentFilePath = fileURLToPath(import.meta.url);
const isDirectExecution = process.argv[1] === currentFilePath;

if (isDirectExecution) {
  main()
    .catch((error: unknown) => {
      console.error('Falha ao executar o seed do CLUTCH:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
