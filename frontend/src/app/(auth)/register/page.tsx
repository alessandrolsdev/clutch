import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import { RegisterForm } from '@/components/auth/register-form';

export default function RegisterPage() {
  return (
    <section className="grid w-full gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <Card tone="accent" className="p-card shadow-glow">
        <div className="flex h-full flex-col justify-between gap-section">
          <div className="space-y-4">
            <Badge tone="accent">CLUTCH auth</Badge>
            <SectionHeading
              level="h2"
              eyebrow="Identity onboarding"
              title="Crie seu perfil e entre direto no CLUTCH."
              description="A rota de cadastro usa o contrato real do backend com sessao protegida por cookie httpOnly."
            />
          </div>

          <div className="space-y-4 text-sm leading-6 text-secondary">
            <p>
              Username: 3 a 30 caracteres com letras, numeros e underscore.
            </p>
            <p>
              Se preferir voltar para a entrada publica, acesse{' '}
              <Link
                href="/"
                className="font-medium text-accent-cyan underline-offset-4 transition hover:text-primary hover:underline"
              >
                a home
              </Link>
              .
            </p>
          </div>
        </div>
      </Card>

      <RegisterForm />
    </section>
  );
}
