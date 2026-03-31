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
        clutch: {
          background: {
            primary: 'var(--background-primary)',
            secondary: 'var(--background-secondary)',
            tertiary: 'var(--background-tertiary)',
          },
          border: {
            DEFAULT: 'var(--border-default)',
            muted: 'var(--border-muted)',
          },
          accent: {
            purple: 'var(--accent-purple)',
            cyan: 'var(--accent-cyan)',
          },
          status: {
            online: 'var(--status-online)',
            ingame: 'var(--status-ingame)',
            afk: 'var(--status-afk)',
            offline: 'var(--status-offline)',
          },
          text: {
            primary: 'var(--text-primary)',
            secondary: 'var(--text-secondary)',
            muted: 'var(--text-muted)',
          },
        },
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
