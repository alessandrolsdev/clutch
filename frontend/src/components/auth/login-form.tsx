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
import { loginRequestSchema, type LoginRequestValues } from '@/schemas/auth';
import { AuthRequestError, login } from '@/services/auth';

const demoCredentials: LoginRequestValues = {
  email: 'clutchplayer@clutch.gg',
  password: 'clutch123',
};

const fieldClassName = 'space-y-2';

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequestValues>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onTouched',
  });

  const handleDemoFill = () => {
    setServerError(null);
    setValue('email', demoCredentials.email, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setValue('password', demoCredentials.password, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      await login(values);
      router.replace('/feed');
      router.refresh();
    } catch (error) {
      if (error instanceof AuthRequestError) {
        setServerError(error.message);
        return;
      }

      setServerError('Não foi possível entrar agora. Tente novamente.');
    }
  });

  return (
    <Card className="p-card shadow-glow">
      <form className="space-y-section" onSubmit={onSubmit} noValidate>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-3">
            <Badge tone="accent">Acesso autenticado</Badge>
            <SectionHeading
              level="h1"
              eyebrow="CLUTCH login"
              title="Entre com sua conta do CLUTCH."
              description="Use a conta demo seeded no backend ou a sua credencial real para acessar a área autenticada."
            />
          </div>

          <Button type="button" variant="secondary" size="sm" onClick={handleDemoFill}>
            Usar demo local
          </Button>
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
            <span className="text-sm font-medium text-primary">Email</span>
            <Input
              type="email"
              autoComplete="email"
              placeholder="seu-email@clutch.gg"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              {...register('email')}
            />
            {errors.email ? (
              <span id="login-email-error" className="text-sm text-status-afk">
                {errors.email.message}
              </span>
            ) : null}
          </label>

          <label className={fieldClassName}>
            <span className="text-sm font-medium text-primary">Senha</span>
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="Sua senha"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              {...register('password')}
            />
            {errors.password ? (
              <span id="login-password-error" className="text-sm text-status-afk">
                {errors.password.message}
              </span>
            ) : null}
          </label>
        </div>

        <div className="space-y-4">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </Button>

          <p className="text-center text-sm text-secondary">
            Ainda não tem conta?{' '}
            <Link
              href="/register"
              className="font-medium text-accent-cyan underline-offset-4 transition hover:text-primary hover:underline"
            >
              Criar conta
            </Link>
          </p>
        </div>
      </form>
    </Card>
  );
}
