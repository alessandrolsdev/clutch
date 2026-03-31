'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createPostRequestSchema,
  type CreatePostRequest,
} from '@/schemas/feed';
import { createPost, FeedRequestError } from '@/services/feed';

type CreatePostFormProps = {
  userId: string;
};

const postTypeOptions: Array<{
  value: CreatePostRequest['type'];
  label: string;
}> = [
  { value: 'TEXT', label: 'Texto' },
  { value: 'IMAGE', label: 'Imagem' },
  { value: 'ACHIEVEMENT', label: 'Conquista' },
  { value: 'GAME_SESSION', label: 'Sessao' },
];

export function CreatePostForm({ userId }: CreatePostFormProps) {
  const queryClient = useQueryClient();
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreatePostRequest>({
    resolver: zodResolver(createPostRequestSchema),
    defaultValues: {
      contentText: '',
      mediaUrl: '',
      type: 'TEXT',
    },
    mode: 'onChange',
  });

  const createPostMutation = useMutation({
    mutationFn: createPost,
    onSuccess: async () => {
      setServerError(null);
      setFeedbackMessage('Post publicado com sucesso.');
      reset({
        contentText: '',
        mediaUrl: '',
        type: 'TEXT',
      });
      await queryClient.invalidateQueries({
        queryKey: ['feed', userId],
      });
    },
    onError: (error) => {
      setFeedbackMessage(null);

      if (error instanceof FeedRequestError) {
        setServerError(error.message);
        return;
      }

      setServerError('Nao foi possivel publicar agora. Tente novamente.');
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFeedbackMessage(null);
    setServerError(null);

    try {
      await createPostMutation.mutateAsync(values);
    } catch {
      return;
    }
  });

  return (
    <Card>
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-secondary">
            Novo post
          </p>
          <h2 className="font-display text-2xl font-semibold text-primary">
            Compartilhe algo com sua timeline
          </h2>
          <p className="text-sm leading-6 text-secondary">
            O backend decide sozinho se o post recebe game context com base na sua
            presenca atual.
          </p>
        </div>

        {feedbackMessage ? (
          <div
            role="status"
            className="rounded-control border border-status-online/30 bg-[rgba(16,185,129,0.12)] px-control-x py-control-y text-sm text-primary"
          >
            {feedbackMessage}
          </div>
        ) : null}

        {serverError ? (
          <div
            role="alert"
            className="rounded-control border border-status-afk/40 bg-[rgba(245,158,11,0.12)] px-control-x py-control-y text-sm text-primary"
          >
            {serverError}
          </div>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-primary">Conteudo</span>
          <textarea
            className="min-h-32 w-full rounded-control border border-border bg-background-tertiary px-control-x py-control-y text-sm text-primary outline-none transition placeholder:text-secondary focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/30"
            placeholder="O que voce quer compartilhar hoje?"
            aria-invalid={Boolean(errors.contentText)}
            aria-describedby={errors.contentText ? 'post-content-error' : undefined}
            {...register('contentText')}
          />
          {errors.contentText ? (
            <span id="post-content-error" className="text-sm text-status-afk">
              {errors.contentText.message}
            </span>
          ) : null}
        </label>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_13rem]">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-primary">
              URL de midia
            </span>
            <Input
              placeholder="https://..."
              aria-invalid={Boolean(errors.mediaUrl)}
              aria-describedby={errors.mediaUrl ? 'post-media-error' : undefined}
              {...register('mediaUrl')}
            />
            {errors.mediaUrl ? (
              <span id="post-media-error" className="text-sm text-status-afk">
                {errors.mediaUrl.message}
              </span>
            ) : null}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-primary">Tipo</span>
            <select
              className="h-11 rounded-control border border-border bg-background-tertiary px-control-x text-sm text-primary outline-none transition focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/30"
              {...register('type')}
            >
              {postTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-end">
          <Button type="submit" disabled={createPostMutation.isPending}>
            {createPostMutation.isPending ? 'Publicando...' : 'Publicar post'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
