'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { RemoteImageField } from '@/components/media/remote-image-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils/cn';
import {
  createPostRequestSchema,
  type CreatePostRequest,
} from '@/schemas/feed';
import { createPost, FeedRequestError } from '@/services/feed';
import { uploadImage } from '@/services/media';

type CreatePostFormProps = {
  userId: string;
};

const postTypeOptions: Array<{
  value: CreatePostRequest['type'];
  label: string;
  description: string;
  hint: string;
  placeholder: string;
  mediaDescription: string;
  mediaEmptyDescription: string;
}> = [
  {
    value: 'TEXT',
    label: 'Texto',
    description: 'Atualizacao rapida sobre o que voce jogou, descobriu ou quer registrar.',
    hint: 'Use para um registro direto do dia sem depender de imagem.',
    placeholder: 'Conte o que rolou na sua jogatina, no seu progresso ou no momento de hoje.',
    mediaDescription:
      'Imagem opcional para complementar esse registro. O upload real continua disponivel e a URL publica segue como fallback.',
    mediaEmptyDescription:
      'Adicione uma imagem se quiser dar contexto visual ao seu registro.',
  },
  {
    value: 'IMAGE',
    label: 'Imagem',
    description: 'Publique uma captura, setup ou momento visual da sua jogatina.',
    hint: 'Ideal quando a imagem conta a historia e o texto entra como legenda.',
    placeholder: 'Adicione contexto para a imagem: o que esta acontecendo aqui?',
    mediaDescription:
      'Envie uma imagem do seu computador. A URL publica continua disponivel como fallback explicito.',
    mediaEmptyDescription:
      'Envie uma captura ou use uma URL publica para registrar esse momento visual.',
  },
  {
    value: 'ACHIEVEMENT',
    label: 'Conquista',
    description: 'Registre rank, trofeu, zerada ou objetivo concluido.',
    hint: 'Bom para marcar um marco do progresso, mesmo sem print.',
    placeholder: 'Qual conquista, rank ou objetivo voce desbloqueou hoje?',
    mediaDescription:
      'Imagem opcional para comprovar ou ilustrar a conquista. O upload real continua disponivel.',
    mediaEmptyDescription:
      'Adicione uma imagem se quiser mostrar a conquista, mas ela nao e obrigatoria.',
  },
  {
    value: 'GAME_SESSION',
    label: 'Sessao',
    description: 'Resuma a sessao atual ou mais recente e o contexto da partida.',
    hint: 'Use para registrar o que jogou, com quem e como a sessao terminou.',
    placeholder: 'Como foi a sessao, o que voce jogou e qual era o objetivo?',
    mediaDescription:
      'Imagem opcional para complementar a sessao. O upload real continua disponivel e a URL publica segue como fallback.',
    mediaEmptyDescription:
      'Adicione uma imagem se ela ajudar a contar como foi a sessao.',
  },
];

export function CreatePostForm({ userId }: CreatePostFormProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
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
      setFeedbackMessage('Registro publicado com sucesso.');
      showToast({
        title: 'Registro publicado com sucesso',
        description: 'Seu diario gamer ja foi atualizado no feed.',
        tone: 'success',
      });
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
        showToast({
          title: 'Nao foi possivel publicar o post',
          description: error.message,
          tone: 'error',
        });
        return;
      }

      setServerError('Nao foi possivel publicar agora. Tente novamente.');
      showToast({
        title: 'Nao foi possivel publicar o post',
        description: 'Tente novamente em alguns instantes.',
        tone: 'error',
      });
    },
  });
  const mediaUrl = watch('mediaUrl');
  const selectedPostType = watch('type');
  const selectedPostTypeOption =
    postTypeOptions.find((option) => option.value === selectedPostType) ??
    postTypeOptions[0]!;

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
            Registre algo no seu diario gamer
          </h2>
          <p className="text-sm leading-6 text-secondary">
            Marque uma sessao, conte um momento da jogatina ou registre uma conquista.
            Se sua presenca estiver ativa, o CLUTCH tenta contextualizar o post com
            base no jogo atual.
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

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-primary">
            Como este registro entra no feed
          </legend>
          <p className="text-sm leading-6 text-secondary">
            Escolha o formato que mais combina com o momento que voce quer guardar.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {postTypeOptions.map((option) => {
              const isSelected = option.value === selectedPostType;

              return (
                <label
                  key={option.value}
                  className={cn(
                    'cursor-pointer rounded-control border px-4 py-4 transition',
                    isSelected
                      ? 'border-accent-cyan bg-[rgba(6,182,212,0.12)]'
                      : 'border-border bg-background-tertiary/40 hover:border-accent-cyan/40',
                  )}
                >
                  <input
                    type="radio"
                    value={option.value}
                    className="sr-only"
                    aria-label={`Tipo ${option.label}`}
                    {...register('type')}
                  />
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-primary">{option.label}</span>
                      {isSelected ? <Badge tone="accent">Selecionado</Badge> : null}
                    </div>
                    <p className="text-sm leading-6 text-primary/90">{option.description}</p>
                    <p className="text-xs uppercase tracking-[0.24em] text-secondary">
                      {option.hint}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div
          data-testid="selected-post-type-summary"
          className="rounded-control border border-border bg-background-tertiary/50 px-control-x py-control-y"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-secondary">
            Tipo selecionado
          </p>
          <div className="mt-2 space-y-1">
            <p className="text-sm font-semibold text-primary">
              {selectedPostTypeOption.label}
            </p>
            <p className="text-sm leading-6 text-secondary">
              {selectedPostTypeOption.hint}
            </p>
          </div>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-primary">Registro</span>
          <textarea
            className="min-h-32 w-full rounded-control border border-border bg-background-tertiary px-control-x py-control-y text-sm text-primary outline-none transition placeholder:text-secondary focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/30"
            placeholder={selectedPostTypeOption.placeholder}
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

        <input type="hidden" {...register('mediaUrl')} />

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_13rem]">
          <div className="min-w-0">
            <RemoteImageField
              id="post-media-url"
              label="Imagem do post"
              value={mediaUrl}
              onChange={(value) => {
                setValue('mediaUrl', value, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                });
              }}
              onUploadFile={async (file) => {
                const uploadedImage = await uploadImage(file);
                setValue('type', 'IMAGE', {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                });
                return uploadedImage.url;
              }}
              error={errors.mediaUrl?.message}
              previewAlt="Preview da imagem do post"
              emptyTitle="Nenhuma imagem selecionada"
              emptyDescription={selectedPostTypeOption.mediaEmptyDescription}
              description={selectedPostTypeOption.mediaDescription}
              previewClassName="aspect-[16/9]"
            />
          </div>

          <div className="space-y-2 self-start rounded-control border border-border bg-background-tertiary/40 px-4 py-4">
            <span className="text-sm font-medium text-primary">Resumo do formato</span>
            <p className="text-sm leading-6 text-secondary">
              <span className="font-semibold text-primary">{selectedPostTypeOption.label}:</span>{' '}
              {selectedPostTypeOption.description}
            </p>
            <p className="text-sm leading-6 text-secondary">
              O tipo continua usando o mesmo contrato do backend. O upload real so
              preenche `mediaUrl` quando voce adicionar uma imagem.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Button type="submit" disabled={createPostMutation.isPending}>
            {createPostMutation.isPending ? 'Registrando...' : 'Registrar no feed'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
