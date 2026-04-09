'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { HydrationSafeTime } from '@/components/ui/hydration-safe-time';
import { commentContentSchema, type PostComment } from '@/schemas/feed';
import {
  createPostComment,
  FeedRequestError,
  fetchPostComments,
} from '@/services/feed';

type CommentSectionProps = {
  postId: string;
  initialCommentCount: number;
};

type CommentComposerProps = {
  placeholder: string;
  submitLabel: string;
  disabled: boolean;
  onSubmit: (content: string) => Promise<void>;
};

function resolveCommentAuthorName(comment: PostComment | PostComment['replies'][number]) {
  return comment.author.profile?.displayName && comment.author.profile.displayName.length > 0
    ? comment.author.profile.displayName
    : comment.author.username;
}

function CommentComposer({
  placeholder,
  submitLabel,
  disabled,
  onSubmit,
}: CommentComposerProps) {
  const [content, setContent] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();

        const result = commentContentSchema.safeParse(content);

        if (!result.success) {
          setValidationError(result.error.issues[0]?.message ?? 'Comentario invalido.');
          return;
        }

        setValidationError(null);
        try {
          await onSubmit(result.data);
          setContent('');
        } catch {
          return;
        }
      }}
    >
      <label className="block space-y-2">
        <span className="sr-only">{placeholder}</span>
        <textarea
          className="min-h-24 w-full rounded-control border border-border bg-background-tertiary px-control-x py-control-y text-sm text-primary outline-none transition placeholder:text-secondary focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/30"
          placeholder={placeholder}
          value={content}
          disabled={disabled}
          onChange={(event) => {
            setContent(event.target.value);
            if (validationError) {
              setValidationError(null);
            }
          }}
        />
      </label>

      {validationError ? (
        <p role="alert" className="text-sm text-status-afk">
          {validationError}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={disabled}>
          {disabled ? 'Enviando...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  disabled,
  onReply,
}: {
  comment: PostComment;
  disabled: boolean;
  onReply: (parentId: string, content: string) => Promise<void>;
}) {
  const [isReplying, setIsReplying] = useState(false);
  const authorName = resolveCommentAuthorName(comment);
  const avatarFallback = comment.author.username.slice(0, 2).toUpperCase();

  return (
    <article className="space-y-3 rounded-control border border-border/80 bg-background-secondary/60 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar
            src={comment.author.profile?.avatarUrl}
            alt={comment.author.username}
            fallback={avatarFallback}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-primary">{authorName}</p>
            <p className="truncate text-xs text-secondary">@{comment.author.username}</p>
          </div>
        </div>

        <HydrationSafeTime
          value={comment.createdAt}
          options={{ dateStyle: 'short', timeStyle: 'short' }}
          fallback={comment.createdAt}
          className="text-xs text-secondary"
        />
      </header>

      <p className="text-sm leading-6 text-primary">{comment.content}</p>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-secondary">
          {comment.replies.length} resposta{comment.replies.length === 1 ? '' : 's'}
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={() => {
            setIsReplying((current) => !current);
          }}
        >
          {isReplying ? 'Cancelar reply' : 'Responder'}
        </Button>
      </div>

      {isReplying ? (
        <CommentComposer
          placeholder={`Responder ${authorName}`}
          submitLabel="Enviar reply"
          disabled={disabled}
          onSubmit={async (content) => {
            await onReply(comment.id, content);
            setIsReplying(false);
          }}
        />
      ) : null}

      {comment.replies.length > 0 ? (
        <div className="space-y-3 border-l border-border/80 pl-4">
          {comment.replies.map((reply) => {
            const replyAuthorName = resolveCommentAuthorName(reply);
            const replyFallback = reply.author.username.slice(0, 2).toUpperCase();

            return (
              <article
                key={reply.id}
                className="space-y-2 rounded-control bg-background-primary/60 p-3"
              >
                <header className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar
                      src={reply.author.profile?.avatarUrl}
                      alt={reply.author.username}
                      fallback={replyFallback}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-primary">
                        {replyAuthorName}
                      </p>
                      <p className="truncate text-xs text-secondary">
                        @{reply.author.username}
                      </p>
                    </div>
                  </div>

                  <HydrationSafeTime
                    value={reply.createdAt}
                    options={{ dateStyle: 'short', timeStyle: 'short' }}
                    fallback={reply.createdAt}
                    className="text-xs text-secondary"
                  />
                </header>

                <p className="text-sm leading-6 text-primary">{reply.content}</p>
              </article>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}

export function CommentSection({
  postId,
  initialCommentCount,
}: CommentSectionProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    setCommentCount(initialCommentCount);
  }, [initialCommentCount]);

  const commentsQuery = useQuery({
    queryKey: ['post-comments', postId],
    queryFn: () => fetchPostComments(postId),
    enabled: isOpen,
  });

  const createCommentMutation = useMutation({
    mutationFn: createPostComment,
    onSuccess: async () => {
      setServerError(null);
      setCommentCount((current) => current + 1);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['post-comments', postId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['feed'],
        }),
      ]);
    },
    onError: (error) => {
      if (error instanceof FeedRequestError) {
        setServerError(error.message);
        return;
      }

      setServerError('Nao foi possivel enviar o comentario agora.');
    },
  });

  const submitComment = async (content: string, parentId?: string) => {
    setServerError(null);
    await createCommentMutation.mutateAsync({
      postId,
      content,
      parentId,
    });
  };

  return (
    <section className="space-y-4" data-testid="comment-section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setIsOpen((current) => !current);
          }}
        >
          {isOpen ? 'Ocultar comentarios' : 'Abrir comentarios'}
        </Button>
        <span className="text-xs text-secondary">
          {commentCount} comentario{commentCount === 1 ? '' : 's'}
        </span>
      </div>

      {isOpen ? (
        <div className="space-y-4">
          <CommentComposer
            placeholder="Escreva um comentario"
            submitLabel="Comentar"
            disabled={createCommentMutation.isPending}
            onSubmit={async (content) => {
              await submitComment(content);
            }}
          />

          {serverError ? (
            <p role="alert" className="text-sm text-status-afk">
              {serverError}
            </p>
          ) : null}

          {commentsQuery.isPending ? (
            <div className="rounded-control border border-border/80 bg-background-secondary/60 p-4 text-sm text-secondary">
              Carregando comentarios...
            </div>
          ) : null}

          {commentsQuery.isError ? (
            <div className="rounded-control border border-border/80 bg-background-secondary/60 p-4 text-sm text-status-afk">
              Nao foi possivel carregar os comentarios deste post.
            </div>
          ) : null}

          {commentsQuery.data && commentsQuery.data.length === 0 ? (
            <div className="rounded-control border border-border/80 bg-background-secondary/60 p-4 text-sm text-secondary">
              Ainda nao existem comentarios para este post.
            </div>
          ) : null}

          {commentsQuery.data && commentsQuery.data.length > 0 ? (
            <div className="space-y-4">
              {commentsQuery.data.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  disabled={createCommentMutation.isPending}
                  onReply={async (parentId, content) => {
                    await submitComment(content, parentId);
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
