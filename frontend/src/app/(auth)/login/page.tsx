import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <section className="grid w-full gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <Card tone="accent" className="p-card shadow-glow">
        <div className="flex h-full flex-col justify-between gap-section">
          <div className="space-y-4">
            <Badge tone="accent">CLUTCH auth</Badge>
            <SectionHeading
              level="h2"
              eyebrow="Identity shell"
              title="Acesse o currículo vivo do CLUTCH."
              description="A tela de login já conversa com o contrato real do backend e prepara a base para a proteção de rotas que vem na próxima issue."
            />
          </div>

          <div className="space-y-4 text-sm leading-6 text-secondary">
            <p>
              O fluxo usa a conta demo seeded localmente para facilitar validação sem
              dependências externas.
            </p>
            <p>
              Se você quiser revisar a página pública, volte para{' '}
              <Link
                href="/"
                className="font-medium text-accent-cyan underline-offset-4 transition hover:text-primary hover:underline"
              >
                a entrada pública
              </Link>
              .
            </p>
          </div>
        </div>
      </Card>

      <LoginForm />
    </section>
  );
}
