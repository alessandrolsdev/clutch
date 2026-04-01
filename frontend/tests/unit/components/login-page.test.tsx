import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '@/app/(auth)/login/page';
import { AuthRequestError, login as mockedLogin } from '@/services/auth';

const pushMock = vi.fn();
const replaceMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    refresh: refreshMock,
  }),
}));

vi.mock('@/services/auth', () => ({
  login: vi.fn(),
  AuthRequestError: class AuthRequestError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = 'AuthRequestError';
      this.status = status;
    }
  },
}));

const mockedLoginFn = vi.mocked(mockedLogin);

describe('LoginPage', () => {
  beforeEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
    refreshMock.mockReset();
    mockedLoginFn.mockReset();
  });

  it(
    'renders the login page shell',
    () => {
      render(<LoginPage />);

      expect(
        screen.getByRole('heading', { name: /vivo do clutch/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /entre com sua conta do clutch/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
    },
    10000,
  );

  it('shows validation errors for empty fields', async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText(/digite um email/i)).toBeInTheDocument();
    expect(
      screen.getByText(/a senha precisa ter pelo menos 6 caracteres/i),
    ).toBeInTheDocument();
    expect(mockedLoginFn).not.toHaveBeenCalled();
  });

  it('submits the form and navigates to the authenticated area', async () => {
    mockedLoginFn.mockResolvedValue({
      id: 'user-1',
      username: 'clutchplayer',
      message: 'Acesso autorizado.',
    });

    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: /usar demo local/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toHaveValue('clutchplayer@clutch.gg');
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(mockedLoginFn).toHaveBeenCalledWith({
        email: 'clutchplayer@clutch.gg',
        password: 'clutch123',
      });
    });

    expect(replaceMock).toHaveBeenCalledWith('/feed');
    expect(refreshMock).toHaveBeenCalled();
  });

  it('renders backend credential errors', async () => {
    mockedLoginFn.mockRejectedValue(
      new AuthRequestError(401, 'Credenciais invalidas.'),
    );

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'clutchplayer@clutch.gg' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/credenciais inv/i);
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
