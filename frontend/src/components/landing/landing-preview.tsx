'use client';

import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const importedGames = [
  {
    name: 'Counter-Strike 2',
    platform: 'STEAM',
    hours: '980h',
  },
  {
    name: 'Fortnite',
    platform: 'EPIC',
    hours: '120h',
  },
  {
    name: 'Hades',
    platform: 'IGDB',
    hours: '42h',
  },
];

export function LandingPreview() {
  return (
    <div className="relative" data-testid="landing-preview">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <Card className="relative overflow-hidden border-[rgba(124,58,237,0.18)] bg-[rgba(10,10,15,0.82)] shadow-glow">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.18),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.14),transparent_32%)]" />

          <div className="relative space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-secondary">
                  Preview
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold text-primary">
                  Perfil unificado do gamer
                </h2>
              </div>
              <Badge tone="accent">Beta local</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-surface border border-border bg-background-secondary/80 p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-background-tertiary font-display text-lg font-semibold text-primary">
                    C
                  </div>
                  <div className="space-y-1">
                    <p className="font-display text-xl font-semibold text-primary">
                      CLUTCH Player
                    </p>
                    <p className="text-sm text-secondary">@clutchplayer</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="success">Online</Badge>
                      <Badge tone="neutral">PC</Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-control border border-border bg-background-primary/70 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.28em] text-secondary">
                      Nivel
                    </p>
                    <p className="mt-2 font-display text-2xl font-semibold text-primary">
                      18
                    </p>
                  </div>
                  <div className="rounded-control border border-border bg-background-primary/70 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.28em] text-secondary">
                      Amigos
                    </p>
                    <p className="mt-2 font-display text-2xl font-semibold text-primary">
                      12
                    </p>
                  </div>
                  <div className="rounded-control border border-border bg-background-primary/70 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.28em] text-secondary">
                      Library
                    </p>
                    <p className="mt-2 font-display text-2xl font-semibold text-primary">
                      80
                    </p>
                  </div>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.12, ease: 'easeOut' }}
                className="rounded-surface border border-border bg-background-secondary/85 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-secondary">
                      Biblioteca recente
                    </p>
                    <p className="mt-2 font-display text-lg font-semibold text-primary">
                      Jogos conectados
                    </p>
                  </div>
                  <Badge tone="warning">Import sync</Badge>
                </div>

                <div className="mt-4 space-y-3">
                  {importedGames.map((game, index) => (
                    <motion.div
                      key={game.name}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.35,
                        delay: 0.2 + index * 0.08,
                        ease: 'easeOut',
                      }}
                      className="flex items-center gap-3 rounded-control border border-border bg-background-primary/75 px-3 py-3"
                    >
                      <div className="flex h-12 w-10 items-center justify-center rounded-control bg-background-tertiary text-[10px] uppercase tracking-[0.25em] text-secondary">
                        Art
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-primary">
                          {game.name}
                        </p>
                        <p className="text-xs uppercase tracking-[0.24em] text-secondary">
                          {game.platform}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-accent-cyan">
                        {game.hours}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
