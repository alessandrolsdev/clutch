import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreatePostForm } from '@/components/feed/create-post-form';
import { ToastProvider } from '@/components/ui/toaster';
import { createPost, FeedRequestError } from '@/services/feed';
import { uploadImage } from '@/services/media';

vi.mock('@/services/feed', () => ({
  createPost: vi.fn(),
  FeedRequestError: class FeedRequestError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = 'FeedRequestError';
      this.status = status;
    }
  },
}));

vi.mock('@/services/media', () => ({
  uploadImage: vi.fn(),
}));

const mockedCreatePost = vi.mocked(createPost);
const mockedUploadImage = vi.mocked(uploadImage);

function renderCreatePostForm() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

  render(
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <CreatePostForm userId="user-1" />
      </QueryClientProvider>
    </ToastProvider>,
  );

  return { invalidateQueriesSpy };
}

describe('CreatePostForm', () => {
  beforeEach(() => {
    mockedCreatePost.mockReset();
    mockedUploadImage.mockReset();
    vi.stubGlobal('navigator', {
      clipboard: {
        readText: vi.fn().mockResolvedValue('https://example.com/post-image.png'),
      },
    });
  });

  it('renders the form fields', () => {
    renderCreatePostForm();

    expect(
      screen.getByRole('heading', { name: /compartilhe algo com sua timeline/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /publicar post/i })).toBeInTheDocument();
  });

  it('validates when both content and media are empty', async () => {
    renderCreatePostForm();

    fireEvent.click(screen.getByRole('button', { name: /publicar post/i }));

    expect(
      await screen.findByText(/adicione texto ou uma url de midia para publicar/i),
    ).toBeInTheDocument();
    expect(mockedCreatePost).not.toHaveBeenCalled();
  });

  it('supports clipboard paste and shows a media preview', async () => {
    renderCreatePostForm();

    fireEvent.click(screen.getByRole('button', { name: /colar link/i }));

    expect(await screen.findByText(/link colado do clipboard/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^imagem do post$/i)).toHaveValue(
      'https://example.com/post-image.png',
    );
    expect(screen.getByAltText(/preview da imagem do post/i)).toHaveAttribute(
      'src',
      'https://example.com/post-image.png',
    );
  });

  it('uploads a local image and switches the post type to image', async () => {
    mockedUploadImage.mockResolvedValue({
      url: 'http://localhost/api/uploads/images/post-image.png',
      contentType: 'image/png',
      size: 1024,
    });

    renderCreatePostForm();

    const fileInput = screen.getByLabelText(/arquivo de imagem para imagem do post/i);
    const imageFile = new File(['image-bytes'], 'post-image.png', {
      type: 'image/png',
    });

    fireEvent.change(fileInput, {
      target: { files: [imageFile] },
    });

    await waitFor(() => {
      expect(mockedUploadImage).toHaveBeenCalledWith(imageFile);
    });

    expect(await screen.findByText(/imagem enviada com sucesso/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^imagem do post$/i)).toHaveValue(
      'http://localhost/api/uploads/images/post-image.png',
    );
    expect(screen.getByLabelText(/tipo/i)).toHaveValue('IMAGE');
  });

  it('submits successfully and invalidates the feed query', async () => {
    mockedCreatePost.mockResolvedValue({
      id: 'post-10',
      userId: 'user-1',
      contentText: 'Novo post',
      mediaUrl: null,
      type: 'TEXT',
      gameContext: null,
      createdAt: '2026-03-31T12:00:00.000Z',
    });

    const { invalidateQueriesSpy } = renderCreatePostForm();

    fireEvent.change(screen.getByLabelText(/conteudo/i), {
      target: { value: 'Novo post' },
    });
    fireEvent.click(screen.getByRole('button', { name: /publicar post/i }));

    await waitFor(() => {
      expect(mockedCreatePost).toHaveBeenCalled();
    });
    expect(mockedCreatePost.mock.calls[0]?.[0]).toEqual({
      contentText: 'Novo post',
      mediaUrl: '',
      type: 'TEXT',
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['feed', 'user-1'],
      });
    });

    expect(await screen.findByText(/post publicado com sucesso\./i)).toBeInTheDocument();
    expect(await screen.findByTestId('toast-item')).toHaveTextContent(
      /post publicado com sucesso/i,
    );
  });

  it('renders backend errors on submit failure', async () => {
    mockedCreatePost.mockRejectedValue(
      new FeedRequestError(400, 'Post precisa ter texto ou midia.'),
    );

    renderCreatePostForm();

    fireEvent.change(screen.getByLabelText(/conteudo/i), {
      target: { value: 'Falha de teste' },
    });
    fireEvent.click(screen.getByRole('button', { name: /publicar post/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /post precisa ter texto ou midia/i,
    );
    expect(await screen.findByTestId('toast-item')).toHaveTextContent(
      /nao foi possivel publicar o post/i,
    );
  });
});
