import { Card } from '@/components/ui/card';
import { type ProfileResponse } from '@/schemas/profile';

type ProfileStatsProps = {
  stats: ProfileResponse['stats'];
};

function formatStatValue(value: number): string | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  return value.toLocaleString('pt-BR');
}

export function ProfileStats({ stats }: ProfileStatsProps) {
  const reputation = formatStatValue(stats.reputation);
  const level = formatStatValue(stats.level);
  const xp = formatStatValue(stats.xp);
  const friendCount = formatStatValue(stats.friendCount);
  const postCount = formatStatValue(stats.postCount);

  return (
    <Card data-testid="profile-stats">
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-secondary">
            Resumo social
          </p>
          <div className="space-y-1">
            <h2 className="font-display text-2xl font-semibold text-primary">
              Estatisticas que sustentam a identidade do perfil
            </h2>
            <p className="text-sm leading-6 text-secondary">
              Progressao, reputacao e alcance social visivel com os dados ja publicados neste
              perfil.
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-control border border-border bg-background-tertiary/75 px-5 py-5">
              <p className="text-xs uppercase tracking-[0.3em] text-secondary">
                Reputacao
              </p>
              <p className="mt-3 font-display text-4xl font-semibold text-primary">
                {reputation ?? 'Indisponivel'}
              </p>
              <p className="mt-2 text-sm leading-6 text-secondary">
                Sinal acumulado de reconhecimento social no ecossistema atual do CLUTCH.
              </p>
            </div>

            <div className="rounded-control border border-border bg-background-tertiary/75 px-5 py-5">
              <p className="text-xs uppercase tracking-[0.3em] text-secondary">
                Progressao
              </p>
              <p className="mt-3 font-display text-4xl font-semibold text-primary">
                {level ? `Nivel ${level}` : 'Nivel indisponivel'}
              </p>
              <p className="mt-2 text-sm leading-6 text-secondary">
                {xp ? `${xp} XP acumulados no perfil atual.` : 'XP indisponivel no payload atual.'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-control border border-border bg-background-secondary/80 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.3em] text-secondary">
                Amigos
              </p>
              <p className="mt-2 font-display text-2xl font-semibold text-primary">
                {friendCount ?? 'Indisponivel'}
              </p>
              <p className="mt-1 text-sm leading-6 text-secondary">
                Relacoes publicas visiveis para leitura rapida do circulo social.
              </p>
            </div>

            <div className="rounded-control border border-border bg-background-secondary/80 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.3em] text-secondary">
                Posts
              </p>
              <p className="mt-2 font-display text-2xl font-semibold text-primary">
                {postCount ?? 'Indisponivel'}
              </p>
              <p className="mt-1 text-sm leading-6 text-secondary">
                Atividade publicada que ajuda a contextualizar a presenca do jogador.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
