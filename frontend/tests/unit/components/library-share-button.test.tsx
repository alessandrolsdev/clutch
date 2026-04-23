import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryShareButton } from '@/components/library/library-share-button';
import { ToastProvider } from '@/components/ui/toaster';

const originalClipboard = globalThis.navigator.clipboard;
const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalPublicAppUrl = process.env.PUBLIC_APP_URL;

function renderWithToastProvider() {
  return render(
    <ToastProvider>
      <LibraryShareButton username="clutchplayer" />
    </ToastProvider>,
  );
}

describe('LibraryShareButton', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://clutch.gg';
    process.env.PUBLIC_APP_URL = '';
  });

  it('copies the public library URL and shows success feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.assign(globalThis.navigator, {
      clipboard: {
        writeText,
      },
    });

    renderWithToastProvider();

    fireEvent.click(screen.getByTestId('library-share-button'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        'https://clutch.gg/clutchplayer/library',
      );
    });

    expect(screen.getByTestId('toast-item')).toHaveTextContent(
      /link da biblioteca copiado/i,
    );
  });

  it('shows an error when clipboard access is unavailable', async () => {
    Object.assign(globalThis.navigator, {
      clipboard: undefined,
    });

    renderWithToastProvider();

    fireEvent.click(screen.getByTestId('library-share-button'));

    await waitFor(() => {
      expect(screen.getByTestId('toast-item')).toHaveTextContent(
        /nao foi possivel copiar o link/i,
      );
    });
  });
});

afterAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl;
  process.env.PUBLIC_APP_URL = originalPublicAppUrl;

  Object.assign(globalThis.navigator, {
    clipboard: originalClipboard,
  });
});
