import type { Metadata } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';
import { MotionEnvironment } from '@/components/ui/motion-environment';

const bodyFont = Barlow({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-body',
});

const displayFont = Barlow_Condensed({
  weight: ['500', '600', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'CLUTCH',
  description:
    'Seu jogo. Sua identidade. Conecte sua biblioteca, encontre seu squad e compartilhe sua história no CLUTCH.',
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body
        className={`${bodyFont.variable} ${displayFont.variable}`}
        suppressHydrationWarning
      >
        <MotionEnvironment>
          <Providers>{children}</Providers>
        </MotionEnvironment>
      </body>
    </html>
  );
}
