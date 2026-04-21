import { type PresenceConnectionStatus } from '@/store/presence-store';

type PresenceConnectionTone = 'neutral' | 'success' | 'warning';

export type PresenceConnectionView = {
  tone: PresenceConnectionTone;
  label: string;
  detail: string;
  badgeLabel: string;
  sourceLabel: string;
};

export function isPresenceRealtimeActive(
  connectionStatus: PresenceConnectionStatus,
): boolean {
  return connectionStatus === 'connected';
}

export function getPresenceConnectionView(
  connectionStatus: PresenceConnectionStatus,
  errorMessage: string | null = null,
): PresenceConnectionView {
  switch (connectionStatus) {
    case 'connected':
      return {
        tone: 'success',
        label: 'Realtime ativo',
        detail: 'Atualizacoes ao vivo estao ativas agora.',
        badgeLabel: 'Ao vivo',
        sourceLabel: 'Presenca ao vivo',
      };
    case 'connecting':
      return {
        tone: 'neutral',
        label: 'Sincronizando presenca',
        detail: 'Usando o snapshot mais recente ate o realtime estabilizar.',
        badgeLabel: 'Sincronizando',
        sourceLabel: 'Snapshot recente',
      };
    case 'reconnecting':
      return {
        tone: 'warning',
        label: 'Reconectando presenca',
        detail: 'Mantendo o snapshot atual enquanto as atualizacoes ao vivo retornam.',
        badgeLabel: 'Reconectando',
        sourceLabel: 'Snapshot durante reconexao',
      };
    case 'auth_error':
      return {
        tone: 'warning',
        label: 'Sessao de presenca expirada',
        detail:
          errorMessage ??
          'Mantendo o snapshot mais recente ate renovar a sessao do realtime.',
        badgeLabel: 'Snapshot',
        sourceLabel: 'Snapshot ate renovar sessao',
      };
    case 'error':
      return {
        tone: 'warning',
        label: 'Atualizacoes ao vivo indisponiveis',
        detail: errorMessage ?? 'Exibindo o snapshot mais recente do backend.',
        badgeLabel: 'Snapshot',
        sourceLabel: 'Snapshot do backend',
      };
    case 'idle':
    default:
      return {
        tone: 'neutral',
        label: 'Presenca ao vivo inativa',
        detail: 'Exibindo o snapshot mais recente do backend.',
        badgeLabel: 'Snapshot',
        sourceLabel: 'Snapshot do backend',
      };
  }
}
