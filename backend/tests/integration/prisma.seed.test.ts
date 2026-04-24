import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../helpers/build-app';
import { DEMO_ACCOUNT, runSeed, SEEDED_ENTITY_IDS } from '../../prisma/seed';

const prisma = new PrismaClient();

describe('Prisma seed', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('executa sem erro, pode ser reexecutado e deixa a conta demo autenticavel', async () => {
    await runSeed(prisma);

    const demoUserRecord = await prisma.user.findUnique({
      where: { email: DEMO_ACCOUNT.email },
      include: {
        profile: true,
        stats: true,
        presence: true,
        platformIntegrations: true,
        gameLibrary: true,
        mediaEntries: {
          where: {
            showcaseRank: {
              not: null,
            },
          },
          include: {
            mediaTitle: true,
          },
        },
      },
    });

    expect(demoUserRecord).not.toBeNull();
    if (!demoUserRecord) {
      throw new Error('Demo user should exist after seed.');
    }

    expect(demoUserRecord.profile?.displayName).toBe('CLUTCH Player');
    expect(demoUserRecord.stats?.friendCount).toBe(2);
    expect(demoUserRecord.presence?.status).toBe('IN_GAME');
    expect(demoUserRecord.platformIntegrations.length).toBeGreaterThanOrEqual(2);
    expect(demoUserRecord.gameLibrary.length).toBeGreaterThanOrEqual(2);
    expect(demoUserRecord.mediaEntries.length).toBeGreaterThanOrEqual(3);
    expect(demoUserRecord.mediaEntries[0]?.mediaTitle.canonicalTitle).toBeTruthy();

    const countsBeforeRerun = {
      posts: await prisma.post.count({ where: { id: { in: [...SEEDED_ENTITY_IDS.posts] } } }),
      comments: await prisma.comment.count({ where: { id: { in: [...SEEDED_ENTITY_IDS.comments] } } }),
      interactions: await prisma.interaction.count({ where: { id: { in: [...SEEDED_ENTITY_IDS.interactions] } } }),
      notifications: await prisma.notification.count({ where: { id: { in: [...SEEDED_ENTITY_IDS.notifications] } } }),
      friendships: await prisma.friendship.count({ where: { id: { in: [...SEEDED_ENTITY_IDS.friendships] } } }),
      friendRequests: await prisma.friendRequest.count({ where: { id: { in: [...SEEDED_ENTITY_IDS.friendRequests] } } }),
      mediaTitles: await prisma.mediaTitle.count({ where: { id: { in: [...SEEDED_ENTITY_IDS.mediaTitles] } } }),
      mediaEntries: await prisma.userMediaEntry.count({ where: { id: { in: [...SEEDED_ENTITY_IDS.mediaEntries] } } }),
    };

    await runSeed(prisma);

    const countsAfterRerun = {
      posts: await prisma.post.count({ where: { id: { in: [...SEEDED_ENTITY_IDS.posts] } } }),
      comments: await prisma.comment.count({ where: { id: { in: [...SEEDED_ENTITY_IDS.comments] } } }),
      interactions: await prisma.interaction.count({ where: { id: { in: [...SEEDED_ENTITY_IDS.interactions] } } }),
      notifications: await prisma.notification.count({ where: { id: { in: [...SEEDED_ENTITY_IDS.notifications] } } }),
      friendships: await prisma.friendship.count({ where: { id: { in: [...SEEDED_ENTITY_IDS.friendships] } } }),
      friendRequests: await prisma.friendRequest.count({ where: { id: { in: [...SEEDED_ENTITY_IDS.friendRequests] } } }),
      mediaTitles: await prisma.mediaTitle.count({ where: { id: { in: [...SEEDED_ENTITY_IDS.mediaTitles] } } }),
      mediaEntries: await prisma.userMediaEntry.count({ where: { id: { in: [...SEEDED_ENTITY_IDS.mediaEntries] } } }),
    };

    expect(countsAfterRerun).toEqual(countsBeforeRerun);

    const app = await buildApp();
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: DEMO_ACCOUNT.email,
        password: DEMO_ACCOUNT.password,
      },
    });

    const loginPayload = loginResponse.json() as {
      id: string;
      username: string;
      token: string;
      message: string;
    };

    expect(loginResponse.statusCode).toBe(200);
    expect(loginPayload).toMatchObject({
      username: 'clutchplayer',
      message: 'Acesso autorizado.',
    });

    const authToken = loginPayload.token;

    const profileResponse = await app.inject({
      method: 'GET',
      url: '/profiles/clutchplayer',
    });
    expect(profileResponse.statusCode).toBe(200);
    expect(profileResponse.json()).toMatchObject({
      username: 'clutchplayer',
      profile: expect.objectContaining({
        displayName: 'CLUTCH Player',
      }),
      otakuShowcase: {
        featured: expect.arrayContaining([
          expect.objectContaining({
            title: 'Sousou no Frieren',
          }),
        ]),
        consumingCount: 2,
        completedCount: 1,
      },
    });

    const friendsResponse = await app.inject({
      method: 'GET',
      url: `/friends/${demoUserRecord.id}`,
    });
    expect(friendsResponse.statusCode).toBe(200);
    expect((friendsResponse.json() as unknown[]).length).toBeGreaterThanOrEqual(2);

    const feedResponse = await app.inject({
      method: 'GET',
      url: `/posts/feed/${demoUserRecord.id}`,
    });
    expect(feedResponse.statusCode).toBe(200);
    const feedPayload = feedResponse.json() as { posts: unknown[] };
    expect(feedPayload.posts.length).toBeGreaterThanOrEqual(4);

    const notificationsResponse = await app.inject({
      method: 'GET',
      url: `/notifications/${demoUserRecord.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const notificationsPayload = notificationsResponse.json() as {
      notifications: unknown[];
      unreadCount: number;
    };
    expect(notificationsResponse.statusCode).toBe(200);
    expect(notificationsPayload).toMatchObject({
      unreadCount: expect.any(Number),
    });
    expect(notificationsPayload.notifications.length).toBeGreaterThanOrEqual(3);
    expect(notificationsPayload.unreadCount).toBeGreaterThanOrEqual(1);

    await app.close();
  }, 30_000);
});
