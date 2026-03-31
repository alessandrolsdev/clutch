import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RegisterPage from '@/app/(auth)/register/page';
import { AuthRequestError, register as mockedRegister } from '@/services/auth';

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
  register: vi.fn(),
  AuthRequestError: class AuthRequestError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = 'AuthRequestError';
      this.status = status;
    }
  },
}));

const mockedRegisterFn = vi.mocked(mockedRegister);

describe('RegisterPage', () => {
  beforeEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
    refreshMock.mockReset();
    mockedRegisterFn.mockReset();
  });

  it('renders the register page shell', () => {
    render(<RegisterPage />);

    expect(
      screen.getByRole('heading', { name: /crie seu perfil e entre direto no clutch/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /comece sua conta gamer no clutch/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument();
  });

  it('validates inputs in real time', async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'ab' },
    });

    await waitFor(() => {
      expect(
        screen.getByText(/o username precisa ter no m/i),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'email-invalido' },
    });

    await waitFor(() => {
      expect(screen.getByText(/digite um email v/i)).toBeInTheDocument();
    });
  });

  it('submits with success and redirects to /feed', async () => {
    mockedRegisterFn.mockResolvedValue({
      id: 'user-10',
      username: 'new_player',
    });

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'new_player' },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'new_player@clutch.gg' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(mockedRegisterFn).toHaveBeenCalledWith({
        username: 'new_player',
        email: 'new_player@clutch.gg',
        password: 'secret123',
      });
    });

    expect(replaceMock).toHaveBeenCalledWith('/feed');
    expect(refreshMock).toHaveBeenCalled();
  });

  it('shows friendly conflict message for 409', async () => {
    mockedRegisterFn.mockRejectedValue(
      new AuthRequestError(409, 'Email ou username ja esta em uso.'),
    );

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'clutchplayer' },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'clutchplayer@clutch.gg' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /email ou username ja estao em uso/i,
    );
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('shows generic message for unexpected error', async () => {
    mockedRegisterFn.mockRejectedValue(new Error('network'));

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'gamer_ok' },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'gamer_ok@clutch.gg' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /nao foi possivel criar sua conta agora/i,
    );
  });
});
