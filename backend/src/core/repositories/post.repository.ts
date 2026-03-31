import { Post, Interaction, Comment } from '@prisma/client';
import { prisma } from '../../infra/database/client';

// ─────────────────────────────────────────────────────────────
// Post Repository
// ─────────────────────────────────────────────────────────────

export interface CreatePostInput {
  userId:      string;
  contentText?: string | null;
  mediaUrl?:    string | null;
  type:         'TEXT' | 'IMAGE' | 'ACHIEVEMENT' | 'GAME_SESSION';
  gameContext?: Record<string, unknown> | null;
}

export interface FeedPage {
  posts:      PostWithAuthor[];
  nextCursor: string | null;
}

export interface PostWithAuthor {
  id:          string;
  contentText: string | null;
  mediaUrl:    string | null;
  type:        string;
  gameContext: Record<string, unknown> | null;
  createdAt:   Date;
  author: {
    id:       string;
    username: string;
    profile: {
      displayName: string | null;
      avatarUrl:   string | null;
      accentColor: string | null;
    } | null;
  };
  _count: {
    interactions: number;
    comments:     number;
  };
}

export interface CommentWithAuthor {
  id:        string;
  content:   string;
  parentId:  string | null;
  createdAt: Date;
  author: {
    id:       string;
    username: string;
    profile: { displayName: string | null; avatarUrl: string | null } | null;
  };
  replies: CommentWithAuthor[];
}

export const postRepository = {

  // ── Posts ──────────────────────────────────────────────────

  async create(input: CreatePostInput): Promise<Post> {
    const post = await prisma.post.create({
      data: {
        userId:      input.userId,
        contentText: input.contentText ?? null,
        mediaUrl:    input.mediaUrl    ?? null,
        type:        input.type,
        gameContext: input.gameContext
          ? JSON.parse(JSON.stringify(input.gameContext))
          : undefined,
      },
    });

    await prisma.userStats.updateMany({
      where: { userId: input.userId },
      data:  { postCount: { increment: 1 } },
    });

    return post;
  },

  async findById(id: string): Promise<Post | null> {
    return prisma.post.findUnique({ where: { id } });
  },

  async deleteById(id: string): Promise<void> {
    const deletedPost = await prisma.post.delete({
      where:  { id },
      select: { userId: true },
    });

    await prisma.userStats.updateMany({
      where: { userId: deletedPost.userId },
      data:  { postCount: { decrement: 1 } },
    });
  },

  async findFeedByUserId(
    userId:  string,
    cursor?: string,
    limit    = 20,
  ): Promise<FeedPage> {
    const friendships = await prisma.friendship.findMany({
      where:  { userId },
      select: { friendId: true },
    });

    const friendIds = friendships.map((f) => f.friendId);
    const authorIds = [userId, ...friendIds];

    const posts = await prisma.post.findMany({
      where:   { userId: { in: authorIds } },
      orderBy: { createdAt: 'desc' },
      take:    limit + 1,
      cursor:  cursor ? { id: cursor } : undefined,
      skip:    cursor ? 1 : 0,
      select: {
        id:          true,
        contentText: true,
        mediaUrl:    true,
        type:        true,
        gameContext: true,
        createdAt:   true,
        user: {
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
          },
        },
        _count: {
          select: { interactions: true, comments: true },
        },
      },
    });

    const hasMore   = posts.length > limit;
    const sliced    = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore ? (sliced[sliced.length - 1]?.id ?? null) : null;

    return {
      posts: sliced.map((p) => ({
        id:          p.id,
        contentText: p.contentText,
        mediaUrl:    p.mediaUrl,
        type:        p.type,
        gameContext: p.gameContext as Record<string, unknown> | null,
        createdAt:   p.createdAt,
        author:      p.user,
        _count:      p._count,
      })),
      nextCursor,
    };
  },

  // ── Interactions ───────────────────────────────────────────

  async toggleInteraction(
    postId: string,
    userId: string,
    type:   'LIKE' | 'GG' | 'F' | 'CLAP' | 'HYPE',
  ): Promise<{ added: boolean }> {
    const existing = await prisma.interaction.findUnique({
      where: { postId_userId_type: { postId, userId, type } },
    });

    if (existing) {
      await prisma.interaction.delete({
        where: { postId_userId_type: { postId, userId, type } },
      });
      return { added: false };
    }

    await prisma.interaction.create({
      data: { postId, userId, type },
    });
    return { added: true };
  },

  async findInteraction(
    postId: string,
    userId: string,
    type:   string,
  ): Promise<Interaction | null> {
    return prisma.interaction.findUnique({
      where: { postId_userId_type: { postId, userId, type: type as 'LIKE' | 'GG' | 'F' | 'CLAP' | 'HYPE' } },
    });
  },

  // ── Comments ───────────────────────────────────────────────

  async createComment(
    postId:   string,
    userId:   string,
    content:  string,
    parentId?: string | null,
  ): Promise<Comment> {
    return prisma.comment.create({
      data: { postId, userId, content, parentId: parentId ?? null },
    });
  },

  async findCommentById(id: string): Promise<Comment | null> {
    return prisma.comment.findUnique({ where: { id } });
  },

  async findCommentsByPostId(postId: string): Promise<CommentWithAuthor[]> {
    const comments = await prisma.comment.findMany({
      where:   { postId, parentId: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id:        true,
        content:   true,
        parentId:  true,
        createdAt: true,
        user: {
          select: {
            id:       true,
            username: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        replies: {
          orderBy: { createdAt: 'asc' },
          select: {
            id:        true,
            content:   true,
            parentId:  true,
            createdAt: true,
            user: {
              select: {
                id:       true,
                username: true,
                profile: { select: { displayName: true, avatarUrl: true } },
              },
            },
            replies: false,
          },
        },
      },
    });

    return comments.map((c) => ({
      id:        c.id,
      content:   c.content,
      parentId:  c.parentId,
      createdAt: c.createdAt,
      author:    c.user,
      replies:   c.replies.map((r) => ({
        id:        r.id,
        content:   r.content,
        parentId:  r.parentId,
        createdAt: r.createdAt,
        author:    r.user,
        replies:   [],
      })),
    }));
  },

};
