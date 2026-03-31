import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/hooks/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
    './src/services/**/*.{ts,tsx}',
    './src/store/**/*.{ts,tsx}',
    './src/types/**/*.{ts,tsx}',
    './tests/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: 'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)',
        muted: 'var(--color-text-muted)',
        background: {
          primary: 'var(--color-background-primary)',
          secondary: 'var(--color-background-secondary)',
          tertiary: 'var(--color-background-tertiary)',
        },
        surface: {
          primary: 'var(--color-surface-primary)',
          elevated: 'var(--color-surface-elevated)',
          overlay: 'var(--color-surface-overlay)',
        },
        border: {
          DEFAULT: 'var(--color-border-default)',
          muted: 'var(--color-border-muted)',
        },
        accent: {
          purple: 'var(--color-accent-purple)',
          cyan: 'var(--color-accent-cyan)',
        },
        status: {
          online: 'var(--color-status-online)',
          ingame: 'var(--color-status-ingame)',
          afk: 'var(--color-status-afk)',
          offline: 'var(--color-status-offline)',
        },
      },
      borderRadius: {
        surface: 'var(--radius-surface)',
        control: 'var(--radius-control)',
        pill: 'var(--radius-pill)',
      },
      spacing: {
        'page-x': 'var(--space-page-x)',
        'page-y': 'var(--space-page-y)',
        section: 'var(--space-section)',
        card: 'var(--space-card)',
        'control-x': 'var(--space-control-x)',
        'control-y': 'var(--space-control-y)',
      },
      boxShadow: {
        glow: '0 20px 45px rgba(6, 182, 212, 0.18)',
      },
      backgroundImage: {
        'foundation-grid':
          'linear-gradient(to right, rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.08) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '56px 56px',
      },
    },
  },
  plugins: [],
};

export default config;
