import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { type FeedPost } from '@/schemas/feed';

type PostCardProps = {
  post: FeedPost;
};

function formatPostDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function PostCard({ post }: PostCardProps) {
  const displayName =
    post.author.profile?.displayName && post.author.profile.displayName.length > 0
      ? post.author.profile.displayName
      : post.author.username;
  const avatarFallback = post.author.username.slice(0, 2).toUpperCase();

  return (
    <Card data-testid="feed-post-card">
      <article className="space-y-4">
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
          <Badge tone="neutral">{post.type}</Badge>
        </header>

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
          <p className="text-xs text-secondary">
            Jogando {post.gameContext.gameName || 'desconhecido'} em{' '}
            {post.gameContext.platform || 'plataforma nao informada'}
          </p>
        ) : null}

        <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary">
          <span>{formatPostDate(post.createdAt)}</span>
          <span>
            {post._count.interactions} reacoes • {post._count.comments} comentarios
          </span>
        </footer>
      </article>
    </Card>
  );
}
