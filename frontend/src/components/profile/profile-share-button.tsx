'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toaster';
import { buildPublicProfileCanonicalUrl } from '@/lib/profile/public-profile-share';

type ProfileShareButtonProps = {
  username: string;
};

export function ProfileShareButton({ username }: ProfileShareButtonProps) {
  const { showToast } = useToast();
  const [isCopying, setIsCopying] = useState(false);

  const handleCopyProfileLink = async () => {
    if (!navigator.clipboard?.writeText) {
      showToast({
        title: 'Nao foi possivel copiar o link',
        description: 'Seu navegador nao liberou acesso ao clipboard nesta superficie.',
        tone: 'error',
      });
      return;
    }

    setIsCopying(true);

    try {
      const profileUrl = buildPublicProfileCanonicalUrl(username);
      await navigator.clipboard.writeText(profileUrl);

      showToast({
        title: 'Link do perfil copiado',
        description: 'O link publico do perfil foi enviado para o clipboard.',
        tone: 'success',
      });
    } catch {
      showToast({
        title: 'Nao foi possivel copiar o link',
        description: 'Tente novamente em alguns instantes.',
        tone: 'error',
      });
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <Button
      data-testid="profile-share-button"
      variant="secondary"
      size="sm"
      onClick={() => {
        void handleCopyProfileLink();
      }}
      aria-label={`Copiar link publico do perfil de @${username}`}
      disabled={isCopying}
    >
      {isCopying ? 'Copiando link...' : 'Copiar link'}
    </Button>
  );
}
