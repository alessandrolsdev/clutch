import { FriendRequest } from '@prisma/client';
import { prisma } from '../../infra/database/client';

// ─────────────────────────────────────────────────────────────
// Friend Repository
// ─────────────────────────────────────────────────────────────

export interface FriendPresence {
  id:       string;
  username: string;
  profile: {
    displayName: string | null;
    avatarUrl:   string | null;
    accentColor: string | null;
  } | null;
  presence: {
    status:      string;
    currentGame: string | null;
    platform:    string | null;
  } | null;
}

export interface PendingRequest {
  id:        string;
  createdAt: Date;
  sender: {
    id:       string;
    username: string;
    profile: {
      displayName: string | null;
      avatarUrl:   string | null;
    } | null;
  };
}

export const friendRepository = {

  // ── Requests ───────────────────────────────────────────────

  async createRequest(senderId: string, receiverId: string): Promise<FriendRequest> {
    return prisma.friendRequest.create({
      data: { senderId, receiverId },
    });
  },

  async findRequestById(id: string): Promise<FriendRequest | null> {
    return prisma.friendRequest.findUnique({ where: { id } });
  },

  async existsRequest(senderId: string, receiverId: string): Promise<boolean> {
    const request = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
        status: 'PENDING',
      },
      select: { id: true },
    });
    return request !== null;
  },

  // ── Friendships ────────────────────────────────────────────

  async existsFriendship(userId: string, friendId: string): Promise<boolean> {
    const friendship = await prisma.friendship.findFirst({
      where:  { userId, friendId },
      select: { id: true },
    });
    return friendship !== null;
  },

  async acceptRequest(requestId: string, senderId: string, receiverId: string): Promise<void> {
    await prisma.$transaction([
      prisma.friendRequest.update({
        where: { id: requestId },
        data:  { status: 'ACCEPTED' },
      }),
      prisma.friendship.createMany({
        data: [
          { userId: senderId,   friendId: receiverId },
          { userId: receiverId, friendId: senderId   },
        ],
      }),
      prisma.userStats.updateMany({
        where: { userId: { in: [senderId, receiverId] } },
        data:  { friendCount: { increment: 1 } },
      }),
    ]);
  },

  async removeFriendship(userId: string, friendId: string): Promise<void> {
    await prisma.$transaction([
      prisma.friendship.deleteMany({
        where: {
          OR: [
            { userId, friendId },
            { userId: friendId, friendId: userId },
          ],
        },
      }),
      prisma.userStats.updateMany({
        where: { userId: { in: [userId, friendId] } },
        data:  { friendCount: { decrement: 1 } },
      }),
    ]);
  },

  async findFriendsByUserId(userId: string): Promise<FriendPresence[]> {
    const friendships = await prisma.friendship.findMany({
      where: { userId },
      select: {
        friend: {
          select: {
            id:       true,
            username: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl:   true,
                accentColor: true,
              },
            },
            presence: {
              select: {
                status:      true,
                currentGame: true,
                platform:    true,
              },
            },
          },
        },
      },
    });

    return friendships.map((f) => f.friend);
  },

  async findFriendIdsByUserId(userId: string): Promise<string[]> {
    const friendships = await prisma.friendship.findMany({
      where:  { userId },
      select: { friendId: true },
    });

    return friendships.map((friendship) => friendship.friendId);
  },

  async findPendingRequests(receiverId: string): Promise<PendingRequest[]> {
    return prisma.friendRequest.findMany({
      where:   { receiverId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: {
        id:        true,
        createdAt: true,
        sender: {
          select: {
            id:       true,
            username: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl:   true,
              },
            },
          },
        },
      },
    }) as Promise<PendingRequest[]>;
  },

};
