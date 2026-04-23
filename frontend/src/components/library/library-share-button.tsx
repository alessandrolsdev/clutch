'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toaster';
import { buildPublicLibraryCanonicalUrl } from '@/lib/profile/public-library-share';

type LibraryShareButtonProps = {
  username: string;
};

export function LibraryShareButton({ username }: LibraryShareButtonProps) {
  const { showToast } = useToast();
  const [isCopying, setIsCopying] = useState(false);

  const handleCopyLibraryLink = async () => {
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
      const libraryUrl = buildPublicLibraryCanonicalUrl(username);
      await navigator.clipboard.writeText(libraryUrl);

      showToast({
        title: 'Link da biblioteca copiado',
        description: 'O link publico da biblioteca foi enviado para o clipboard.',
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
      data-testid="library-share-button"
      variant="secondary"
      size="sm"
      onClick={() => {
        void handleCopyLibraryLink();
      }}
      aria-label={`Copiar link publico da biblioteca de @${username}`}
      disabled={isCopying}
    >
      {isCopying ? 'Copiando link...' : 'Copiar link'}
    </Button>
  );
}
