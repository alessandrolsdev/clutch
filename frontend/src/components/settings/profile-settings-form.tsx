'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { RemoteImageField } from '@/components/media/remote-image-field';
import { GamerCard } from '@/components/profile/gamer-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import { useAuth } from '@/hooks/use-auth';
import { normalizeRemoteUrl, isValidRemoteUrl } from '@/lib/media/remote-url';
import {
  profileUpdateRequestSchema,
  type ProfileResponse,
  type ProfileUpdateValues,
} from '@/schemas/profile';
import {
  fetchProfileByUsername,
  ProfileRequestError,
  updateProfileByUsername,
} from '@/services/profile';
import { uploadImage } from '@/services/media';

const fieldClassName = 'space-y-2';
const textAreaClassName =
  'min-h-[7rem] w-full rounded-control border border-border bg-background-secondary px-control-x py-control-y text-sm text-primary transition focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-accent-cyan/30';

function isValidAccentColor(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);
}

function buildPreviewProfile(
  profile: ProfileResponse,
  values: ProfileUpdateValues,
): ProfileResponse {
  const displayName = values.displayName ?? profile.profile.displayName ?? '';
  const bio = values.bio ?? profile.profile.bio ?? '';
  const avatarUrl = normalizeRemoteUrl(values.avatarUrl ?? profile.profile.avatarUrl);
  const bannerUrl = normalizeRemoteUrl(values.bannerUrl ?? profile.profile.bannerUrl);
  const accentColor = values.accentColor ?? profile.profile.accentColor;

  return {
    ...profile,
    profile: {
      ...profile.profile,
      displayName: displayName.trim(),
      bio: bio.trim(),
      avatarUrl: isValidRemoteUrl(avatarUrl)
        ? avatarUrl
        : profile.profile.avatarUrl,
      bannerUrl: isValidRemoteUrl(bannerUrl)
        ? bannerUrl
        : profile.profile.bannerUrl,
      accentColor: isValidAccentColor(accentColor)
        ? accentColor
        : profile.profile.accentColor,
    },
  };
}

function ProfileSettingsLoadingState() {
  return (
    <div className="space-y-4" data-testid="settings-profile-loading">
      <Card>
        <div className="h-8 w-56 animate-pulse rounded-control bg-background-tertiary" />
        <div className="mt-4 h-32 animate-pulse rounded-control bg-background-tertiary" />
      </Card>
      <Card>
        <div className="h-48 animate-pulse rounded-control bg-background-tertiary" />
      </Card>
    </div>
  );
}

function ProfileSettingsErrorState({ message }: { message: string }) {
  return (
    <Card data-testid="settings-profile-error">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-secondary">Settings</p>
        <h2 className="font-display text-2xl font-semibold text-primary">
          Nao foi possivel carregar seu perfil
        </h2>
        <p className="text-sm leading-6 text-secondary">{message}</p>
      </div>
    </Card>
  );
}

export function ProfileSettingsForm() {
  const queryClient = useQueryClient();
  const { user, status } = useAuth();
  const [serverFeedback, setServerFeedback] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const username = user?.username ?? null;

  const profileQuery = useQuery({
    queryKey: ['profile', username],
    queryFn: () => fetchProfileByUsername(username as string),
    enabled: status === 'authenticated' && typeof username === 'string',
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileUpdateValues>({
    resolver: zodResolver(profileUpdateRequestSchema),
    values: profileQuery.data
      ? {
          displayName: profileQuery.data.profile.displayName ?? '',
          bio: profileQuery.data.profile.bio ?? '',
          avatarUrl: profileQuery.data.profile.avatarUrl ?? '',
          bannerUrl: profileQuery.data.profile.bannerUrl ?? '',
          accentColor: profileQuery.data.profile.accentColor ?? '#7C3AED',
        }
      : undefined,
    mode: 'onChange',
  });

  const watchedValues = watch();
  const previewProfile = useMemo(() => {
    if (!profileQuery.data) {
      return null;
    }

    return buildPreviewProfile(profileQuery.data, watchedValues);
  }, [profileQuery.data, watchedValues]);

  const updateProfileMutation = useMutation({
    mutationFn: (values: ProfileUpdateValues) =>
      updateProfileByUsername(username as string, values),
    onSuccess: async (_, values) => {
      setServerError(null);
      setServerFeedback('Perfil atualizado com sucesso.');

      queryClient.setQueryData<ProfileResponse | undefined>(
        ['profile', username],
        (current) => {
          if (!current) {
            return current;
          }

          return buildPreviewProfile(current, values);
        },
      );

      await queryClient.invalidateQueries({ queryKey: ['profile', username] });
      reset(values);
    },
    onError: (error) => {
      setServerFeedback(null);

      if (error instanceof ProfileRequestError) {
        setServerError(error.message);
        return;
      }

      setServerError('Nao foi possivel salvar seu perfil agora.');
    },
  });

  if (status === 'loading' || profileQuery.isPending) {
    return <ProfileSettingsLoadingState />;
  }

  if (status !== 'authenticated' || !username || profileQuery.isError || !profileQuery.data) {
    const errorMessage =
      profileQuery.error instanceof ProfileRequestError
        ? profileQuery.error.message
        : 'Tente novamente em alguns instantes.';

    return <ProfileSettingsErrorState message={errorMessage} />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerFeedback(null);
    setServerError(null);
    await updateProfileMutation.mutateAsync(values);
  });

  return (
    <div className="space-y-section" data-testid="settings-profile-success">
      <SectionHeading
        eyebrow="Settings"
        title="Seu perfil do CLUTCH"
        description="Edite os campos suportados pelo backend e acompanhe o preview do seu GamerCard antes de salvar."
        level="h1"
      />

      <div className="grid gap-section xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <Card className="space-y-6">
          {serverFeedback ? (
            <div
              role="status"
              className="rounded-control border border-status-online/40 bg-[rgba(16,185,129,0.12)] px-control-x py-control-y text-sm leading-6 text-primary"
            >
              {serverFeedback}
            </div>
          ) : null}

          {serverError ? (
            <div
              role="alert"
              className="rounded-control border border-status-afk/40 bg-[rgba(245,158,11,0.12)] px-control-x py-control-y text-sm leading-6 text-primary"
            >
              {serverError}
            </div>
          ) : null}

          <form className="space-y-5" onSubmit={onSubmit} noValidate>
            <label className={fieldClassName}>
              <span className="text-sm font-medium text-primary">Display name</span>
              <input
                type="text"
                className="h-11 w-full rounded-control border border-border bg-background-secondary px-control-x text-sm text-primary transition focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-accent-cyan/30"
                placeholder="Seu nome de exibicao"
                aria-invalid={Boolean(errors.displayName)}
                aria-describedby={errors.displayName ? 'settings-display-name-error' : undefined}
                {...register('displayName')}
              />
              {errors.displayName ? (
                <span id="settings-display-name-error" className="text-sm text-status-afk">
                  {errors.displayName.message}
                </span>
              ) : null}
            </label>

            <label className={fieldClassName}>
              <span className="text-sm font-medium text-primary">Bio</span>
              <textarea
                className={textAreaClassName}
                placeholder="Conte um pouco sobre sua identidade gamer e geek."
                aria-invalid={Boolean(errors.bio)}
                aria-describedby={errors.bio ? 'settings-bio-error' : undefined}
                {...register('bio')}
              />
              {errors.bio ? (
                <span id="settings-bio-error" className="text-sm text-status-afk">
                  {errors.bio.message}
                </span>
              ) : null}
            </label>

            <input type="hidden" {...register('avatarUrl')} />
            <input type="hidden" {...register('bannerUrl')} />

            <RemoteImageField
              id="settings-avatar-url"
              label="Avatar"
              value={watchedValues.avatarUrl ?? ''}
              onChange={(value) => {
                setValue('avatarUrl', value, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                });
              }}
              onUploadFile={async (file) => {
                const uploadedImage = await uploadImage(file);
                return uploadedImage.url;
              }}
              error={errors.avatarUrl?.message}
              previewAlt="Preview do avatar"
              emptyTitle="Sem avatar configurado"
              emptyDescription="Envie uma imagem do seu computador ou mantenha uma URL publica como fallback."
              description="O app agora prefere upload real para avatar, sem remover o fluxo por URL publica quando ele ainda fizer sentido."
              previewClassName="h-40 w-40 max-w-full"
              previewImageClassName="rounded-full"
            />

            <RemoteImageField
              id="settings-banner-url"
              label="Banner"
              value={watchedValues.bannerUrl ?? ''}
              onChange={(value) => {
                setValue('bannerUrl', value, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                });
              }}
              onUploadFile={async (file) => {
                const uploadedImage = await uploadImage(file);
                return uploadedImage.url;
              }}
              error={errors.bannerUrl?.message}
              previewAlt="Preview do banner"
              emptyTitle="Sem banner configurado"
              emptyDescription="Envie um banner do seu computador ou use uma URL publica como fallback."
              description="O preview abaixo continua validando a imagem final que sera salva no perfil."
              previewClassName="aspect-[16/6]"
            />

            <label className={fieldClassName}>
              <span className="text-sm font-medium text-primary">Accent color</span>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  className="h-11 flex-1 rounded-control border border-border bg-background-secondary px-control-x text-sm text-primary transition focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-accent-cyan/30"
                  placeholder="#7C3AED"
                  aria-invalid={Boolean(errors.accentColor)}
                  aria-describedby={errors.accentColor ? 'settings-accent-error' : undefined}
                  {...register('accentColor')}
                />
                <span
                  aria-hidden="true"
                  className="h-11 w-11 rounded-control border border-border"
                  style={{
                    backgroundColor: isValidAccentColor(watchedValues.accentColor)
                      ? watchedValues.accentColor
                      : profileQuery.data.profile.accentColor ?? '#7C3AED',
                  }}
                />
              </div>
              {errors.accentColor ? (
                <span id="settings-accent-error" className="text-sm text-status-afk">
                  {errors.accentColor.message}
                </span>
              ) : null}
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isSubmitting || updateProfileMutation.isPending}>
                {isSubmitting || updateProfileMutation.isPending ? 'Salvando...' : 'Salvar perfil'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  reset({
                    displayName: profileQuery.data.profile.displayName ?? '',
                    bio: profileQuery.data.profile.bio ?? '',
                    avatarUrl: profileQuery.data.profile.avatarUrl ?? '',
                    bannerUrl: profileQuery.data.profile.bannerUrl ?? '',
                    accentColor: profileQuery.data.profile.accentColor ?? '#7C3AED',
                  });
                  setServerFeedback(null);
                  setServerError(null);
                }}
              >
                Reverter
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <SectionHeading
            eyebrow="Preview"
            title="GamerCard em tempo real"
            description="O preview aplica apenas valores validos para nao mascarar erros de formulario."
          />
          {previewProfile ? <GamerCard profile={previewProfile} /> : null}
        </div>
      </div>
    </div>
  );
}
