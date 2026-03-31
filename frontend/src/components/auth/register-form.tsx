'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SectionHeading } from '@/components/ui/section-heading';
import {
  registerRequestSchema,
  type RegisterRequestValues,
} from '@/schemas/auth';
import { AuthRequestError, register as registerAccount } from '@/services/auth';

const fieldClassName = 'space-y-2';

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterRequestValues>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
    },
    mode: 'onChange',
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      await registerAccount(values);
      router.replace('/feed');
      router.refresh();
    } catch (error) {
      if (error instanceof AuthRequestError) {
        if (error.status === 409) {
          setServerError('Email ou username ja estao em uso.');
          return;
        }

        setServerError(error.message);
        return;
      }

      setServerError('Nao foi possivel criar sua conta agora. Tente novamente.');
    }
  });

  return (
    <Card className="p-card shadow-glow">
      <form className="space-y-section" onSubmit={onSubmit} noValidate>
        <div className="space-y-3">
          <Badge tone="accent">Criar conta</Badge>
          <SectionHeading
            level="h1"
            eyebrow="CLUTCH register"
            title="Comece sua conta gamer no CLUTCH."
            description="Cadastro com contrato real do backend e sessao local segura via cookie httpOnly."
          />
        </div>

        {serverError ? (
          <div
            role="alert"
            className="rounded-control border border-status-afk/40 bg-[rgba(245,158,11,0.12)] px-control-x py-control-y text-sm leading-6 text-primary"
          >
            {serverError}
          </div>
        ) : null}

        <div className="space-y-4">
          <label className={fieldClassName}>
            <span className="text-sm font-medium text-primary">Username</span>
            <Input
              type="text"
              autoComplete="username"
              placeholder="clutch_player"
              aria-invalid={Boolean(errors.username)}
              aria-describedby={errors.username ? 'register-username-error' : undefined}
              {...register('username')}
            />
            {errors.username ? (
              <span id="register-username-error" className="text-sm text-status-afk">
                {errors.username.message}
              </span>
            ) : null}
          </label>

          <label className={fieldClassName}>
            <span className="text-sm font-medium text-primary">Email</span>
            <Input
              type="email"
              autoComplete="email"
              placeholder="seu-email@clutch.gg"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'register-email-error' : undefined}
              {...register('email')}
            />
            {errors.email ? (
              <span id="register-email-error" className="text-sm text-status-afk">
                {errors.email.message}
              </span>
            ) : null}
          </label>

          <label className={fieldClassName}>
            <span className="text-sm font-medium text-primary">Senha</span>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Pelo menos 6 caracteres"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'register-password-error' : undefined}
              {...register('password')}
            />
            {errors.password ? (
              <span id="register-password-error" className="text-sm text-status-afk">
                {errors.password.message}
              </span>
            ) : null}
          </label>
        </div>

        <div className="space-y-4">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Criando conta...' : 'Criar conta'}
          </Button>

          <p className="text-center text-sm text-secondary">
            Ja tem conta?{' '}
            <Link
              href="/login"
              className="font-medium text-accent-cyan underline-offset-4 transition hover:text-primary hover:underline"
            >
              Entrar
            </Link>
          </p>
        </div>
      </form>
    </Card>
  );
}
