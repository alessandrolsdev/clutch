'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CommentSection } from '@/components/feed/comment-section';
import { GameContextBadge } from '@/components/feed/game-context-badge';
import { ReactionBar } from '@/components/feed/reaction-bar';
import { HydrationSafeTime } from '@/components/ui/hydration-safe-time';
import { useAuth } from '@/hooks/use-auth';
import { type FeedPost } from '@/schemas/feed';
import { deletePost, FeedRequestError } from '@/services/feed';

type PostCardProps = {
  post: FeedPost;
};

type PostTypeTone = 'neutral' | 'accent' | 'success' | 'warning';

type PostCardPresentation = {
  badgeLabel: string;
  badgeTone: PostTypeTone;
  highlightEyebrow: string | null;
  highlightTitle: string | null;
  highlightDetail: string | null;
};

function normalizeContextValue(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : null;
}

function getPostCardPresentation(post: FeedPost): PostCardPresentation {
  const gameName = normalizeContextValue(post.gameContext?.gameName);
  const platform = normalizeContextValue(post.gameContext?.platform);
  const platformDetail = platform ? `Via ${platform}` : null;

  switch (post.type) {
    case 'GAME_SESSION':
      return {
        badgeLabel: 'Sessao',
        badgeTone: 'success',
        highlightEyebrow: 'Registro de sessao',
        highlightTitle: gameName ? `Sessao em ${gameName}` : 'Sessao de jogo registrada',
        highlightDetail: platformDetail,
      };
    case 'ACHIEVEMENT':
      return {
        badgeLabel: 'Conquista',
        badgeTone: 'warning',
        highlightEyebrow: 'Registro de conquista',
        highlightTitle: gameName ? `Conquista em ${gameName}` : 'Conquista registrada',
        highlightDetail: platformDetail,
      };
    case 'IMAGE':
      return {
        badgeLabel: 'Imagem',
        badgeTone: 'accent',
        highlightEyebrow: null,
        highlightTitle: null,
        highlightDetail: null,
      };
    case 'TEXT':
    default:
      return {
        badgeLabel: 'Texto',
        badgeTone: 'neutral',
        highlightEyebrow: null,
        highlightTitle: null,
        highlightDetail: null,
      };
  }
}

export function PostCard({ post }: PostCardProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const postPresentation = getPostCardPresentation(post);
  const displayName =
    post.author.profile?.displayName && post.author.profile.displayName.length > 0
      ? post.author.profile.displayName
      : post.author.username;
  const avatarFallback = post.author.username.slice(0, 2).toUpperCase();
  const isOwnPost = user?.id === post.author.id;

  const deletePostMutation = useMutation({
    mutationFn: deletePost,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['feed'],
      });
    },
  });

  const deleteErrorMessage = deletePostMutation.error instanceof FeedRequestError
    ? deletePostMutation.error.message
    : deletePostMutation.isError
      ? 'Nao foi possivel excluir este post agora.'
      : null;

  return (
    <Card data-testid="feed-post-card">
      <article className="space-y-5">
        <header className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <Avatar
              src={post.author.profile?.avatarUrl}
              alt={post.author.username}
              fallback={avatarFallback}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-primary">
                {displayName}
              </p>
              <p className="truncate text-xs text-secondary">@{post.author.username}</p>
            </div>
          </div>
          <Badge tone={postPresentation.badgeTone}>{postPresentation.badgeLabel}</Badge>
        </header>

        {postPresentation.highlightEyebrow && postPresentation.highlightTitle ? (
          <div className="space-y-2 rounded-control border border-border/80 bg-background-secondary/60 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary">
              {postPresentation.highlightEyebrow}
            </p>
            <div className="space-y-1">
              <p className="text-base font-semibold text-primary">
                {postPresentation.highlightTitle}
              </p>
              {postPresentation.highlightDetail ? (
                <p className="text-sm leading-6 text-secondary">
                  {postPresentation.highlightDetail}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {post.contentText ? (
          <p className="text-sm leading-6 text-primary">{post.contentText}</p>
        ) : null}

        {post.mediaUrl ? (
          <div
            className="h-44 w-full rounded-control border border-border bg-cover bg-center"
            style={{ backgroundImage: `url(${post.mediaUrl})` }}
            role="img"
            aria-label={`Midia do post ${post.id}`}
          />
        ) : null}

        {post.gameContext ? (
          <GameContextBadge gameContext={post.gameContext} />
        ) : null}

        <ReactionBar
          postId={post.id}
          initialReactionCount={post._count.interactions}
          canInteract={!isOwnPost}
        />

        <CommentSection
          postId={post.id}
          initialCommentCount={post._count.comments}
        />

        <footer className="space-y-3 border-t border-border/70 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-secondary">
            <HydrationSafeTime
              value={post.createdAt}
              options={{ dateStyle: 'medium', timeStyle: 'short' }}
              fallback={post.createdAt}
            />
            {isOwnPost ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={deletePostMutation.isPending}
                onClick={() => {
                  deletePostMutation.mutate(post.id);
                }}
              >
                {deletePostMutation.isPending ? 'Excluindo...' : 'Excluir post'}
              </Button>
            ) : null}
          </div>

          {deleteErrorMessage ? (
            <p role="alert" className="text-sm text-status-afk">
              {deleteErrorMessage}
            </p>
          ) : null}
        </footer>
      </article>
    </Card>
  );
}
