import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postRepository } from '@/core/repositories/post.repository';

vi.mock('@/infra/database/client', () => ({
  prisma: {
    post: {
      create:     vi.fn(),
      findUnique: vi.fn(),
      findMany:   vi.fn(),
      delete:     vi.fn(),
    },
    interaction: {
      findUnique: vi.fn(),
      create:     vi.fn(),
      delete:     vi.fn(),
    },
    comment: {
      create:   vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    friendship: {
      findMany: vi.fn(),
    },
    userStats: {
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/infra/database/client';

const mockPost = {
  id:          'post-id-1',
  userId:      'user-id-1',
  contentText: 'Post de teste',
  mediaUrl:    null,
  type:        'TEXT' as const,
  gameContext: null,
  createdAt:   new Date(),
  updatedAt:   new Date(),
};

const mockComment = {
  id:        'comment-id-1',
  postId:    'post-id-1',
  userId:    'user-id-1',
  parentId:  null,
  content:   'Comentário de teste',
  createdAt: new Date(),
};

const mockInteraction = {
  id:        'interaction-id-1',
  postId:    'post-id-1',
  userId:    'user-id-1',
  type:      'GG' as const,
  createdAt: new Date(),
};

describe('postRepository', () => {

  beforeEach(() => vi.clearAllMocks());

  // ── create ─────────────────────────────────────────────────
  describe('create', () => {
    it('cria post e incrementa postCount', async () => {
      vi.mocked(prisma.post.create).mockResolvedValue(mockPost);
      vi.mocked(prisma.userStats.updateMany).mockResolvedValue({ count: 1 });

      const result = await postRepository.create({
        userId:      'user-id-1',
        contentText: 'Post de teste',
        type:        'TEXT',
      });

      expect(result.contentText).toBe('Post de teste');
      expect(prisma.userStats.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-id-1' },
        data:  { postCount: { increment: 1 } },
      });
    });

    it('cria post com gameContext quando IN_GAME', async () => {
      const postWithContext = {
        ...mockPost,
        gameContext: { gameName: 'Valorant', platform: 'PC' },
      };
      vi.mocked(prisma.post.create).mockResolvedValue(postWithContext);
      vi.mocked(prisma.userStats.updateMany).mockResolvedValue({ count: 1 });

      const result = await postRepository.create({
        userId:      'user-id-1',
        contentText: 'Jogando Valorant!',
        type:        'GAME_SESSION',
        gameContext: { gameName: 'Valorant', platform: 'PC' },
      });

      expect(result.gameContext).toMatchObject({ gameName: 'Valorant' });
    });
  });

  // ── findById ───────────────────────────────────────────────
  describe('findById', () => {
    it('retorna post quando ID existe', async () => {
      vi.mocked(prisma.post.findUnique).mockResolvedValue(mockPost);

      const result = await postRepository.findById('post-id-1');

      expect(result).toEqual(mockPost);
    });

    it('retorna null quando ID não existe', async () => {
      vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

      const result = await postRepository.findById('inexistente');

      expect(result).toBeNull();
    });
  });

  describe('deleteById', () => {
    it('deleta post e decrementa postCount do autor correto', async () => {
      vi.mocked(prisma.post.delete).mockResolvedValue({ userId: 'user-id-1' } as never);
      vi.mocked(prisma.userStats.updateMany).mockResolvedValue({ count: 1 });

      await postRepository.deleteById('post-id-1');

      expect(prisma.post.delete).toHaveBeenCalledWith({
        where:  { id: 'post-id-1' },
        select: { userId: true },
      });
      expect(prisma.userStats.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-id-1' },
        data:  { postCount: { decrement: 1 } },
      });
    });
  });

  // ── findFeedByUserId ───────────────────────────────────────
  describe('findFeedByUserId', () => {
    it('retorna feed com posts do usuário e amigos', async () => {
      vi.mocked(prisma.friendship.findMany).mockResolvedValue([
        { id: 'f1', userId: 'user-id-1', friendId: 'user-id-2', createdAt: new Date() },
      ]);

      vi.mocked(prisma.post.findMany).mockResolvedValue([
        {
          ...mockPost,
          user: {
            id: 'user-id-1', username: 'clutchplayer',
            profile: { displayName: 'Clutch', avatarUrl: null, accentColor: null },
          },
          _count: { interactions: 2, comments: 1 },
        } as never,
      ]);

      const result = await postRepository.findFeedByUserId('user-id-1');

      expect(result.posts).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    it('retorna nextCursor quando há mais posts', async () => {
      vi.mocked(prisma.friendship.findMany).mockResolvedValue([]);

      const manyPosts = Array.from({ length: 21 }, (_, i) => ({
        ...mockPost,
        id: `post-id-${i}`,
        user: { id: 'user-id-1', username: 'player', profile: null },
        _count: { interactions: 0, comments: 0 },
      }));

      vi.mocked(prisma.post.findMany).mockResolvedValue(manyPosts as never);

      const result = await postRepository.findFeedByUserId('user-id-1', undefined, 20);

      expect(result.posts).toHaveLength(20);
      expect(result.nextCursor).not.toBeNull();
    });
  });

  // ── toggleInteraction ──────────────────────────────────────
  describe('toggleInteraction', () => {
    it('cria interaction quando não existe (added: true)', async () => {
      vi.mocked(prisma.interaction.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.interaction.create).mockResolvedValue(mockInteraction);

      const result = await postRepository.toggleInteraction('post-id-1', 'user-id-1', 'GG');

      expect(result.added).toBe(true);
      expect(prisma.interaction.create).toHaveBeenCalled();
    });

    it('remove interaction quando já existe (added: false)', async () => {
      vi.mocked(prisma.interaction.findUnique).mockResolvedValue(mockInteraction);
      vi.mocked(prisma.interaction.delete).mockResolvedValue(mockInteraction);

      const result = await postRepository.toggleInteraction('post-id-1', 'user-id-1', 'GG');

      expect(result.added).toBe(false);
      expect(prisma.interaction.delete).toHaveBeenCalled();
    });
  });

  describe('findInteraction', () => {
    it('retorna interaction quando ela existe', async () => {
      vi.mocked(prisma.interaction.findUnique).mockResolvedValue(mockInteraction);

      const result = await postRepository.findInteraction('post-id-1', 'user-id-1', 'GG');

      expect(result).toEqual(mockInteraction);
      expect(prisma.interaction.findUnique).toHaveBeenCalledWith({
        where: {
          postId_userId_type: {
            postId: 'post-id-1',
            userId: 'user-id-1',
            type:   'GG',
          },
        },
      });
    });
  });

  // ── createComment ──────────────────────────────────────────
  describe('createComment', () => {
    it('cria comentário corretamente', async () => {
      vi.mocked(prisma.comment.create).mockResolvedValue(mockComment);

      const result = await postRepository.createComment(
        'post-id-1',
        'user-id-1',
        'Comentário de teste',
      );

      expect(result.content).toBe('Comentário de teste');
      expect(prisma.comment.create).toHaveBeenCalledWith({
        data: {
          postId:   'post-id-1',
          userId:   'user-id-1',
          content:  'Comentário de teste',
          parentId: null,
        },
      });
    });
  });

  describe('findCommentById', () => {
    it('retorna comentario quando existe', async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment);

      const result = await postRepository.findCommentById('comment-id-1');

      expect(result).toEqual(mockComment);
      expect(prisma.comment.findUnique).toHaveBeenCalledWith({
        where: { id: 'comment-id-1' },
      });
    });
  });

  // ── findCommentsByPostId ───────────────────────────────────
  describe('findCommentsByPostId', () => {
    it('retorna comentários com replies aninhados', async () => {
      vi.mocked(prisma.comment.findMany).mockResolvedValue([
        {
          ...mockComment,
          user:    { id: 'user-id-1', username: 'clutch', profile: null },
          replies: [],
        } as never,
      ]);

      const result = await postRepository.findCommentsByPostId('post-id-1');

      expect(result).toHaveLength(1);
      expect(result[0]?.replies).toEqual([]);
    });
  });

});
