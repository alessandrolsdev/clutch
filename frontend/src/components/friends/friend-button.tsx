'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toaster';
import { useAuth } from '@/hooks/use-auth';
import {
  applyAcceptedFriendRequest,
  applyProfileFriendCountDelta,
  applyRemovedFriend,
  buildOptimisticFriendSummary,
  restoreQuerySnapshots,
  snapshotQueryGroups,
} from '@/lib/query/social-cache';
import {
  acceptFriendRequest,
  fetchFriends,
  fetchPendingFriendRequests,
  FriendsRequestError,
  removeFriend,
  sendFriendRequest,
} from '@/services/friends';

type FriendButtonProps = {
  targetUserId: string;
};

export function FriendButton({ targetUserId }: FriendButtonProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user, status } = useAuth();
  const currentUserId = user?.id ?? null;
  const [localPending, setLocalPending] = useState(false);

  const friendsQuery = useQuery({
    queryKey: ['friends', currentUserId],
    queryFn: () => fetchFriends(currentUserId as string),
    enabled: status === 'authenticated' && typeof currentUserId === 'string',
  });

  const pendingRequestsQuery = useQuery({
    queryKey: ['friend-requests', currentUserId],
    queryFn: () => fetchPendingFriendRequests(currentUserId as string),
    enabled: status === 'authenticated' && typeof currentUserId === 'string',
  });

  const incomingRequest = useMemo(
    () =>
      pendingRequestsQuery.data?.find(
        (request) => request.sender.id === targetUserId,
      ) ?? null,
    [pendingRequestsQuery.data, targetUserId],
  );

  const isFriend = useMemo(
    () => friendsQuery.data?.some((friend) => friend.id === targetUserId) ?? false,
    [friendsQuery.data, targetUserId],
  );

  useEffect(() => {
    if (isFriend || incomingRequest) {
      setLocalPending(false);
    }
  }, [incomingRequest, isFriend]);

  const sendRequestMutation = useMutation({
    mutationFn: sendFriendRequest,
    onMutate: () => {
      setLocalPending(true);
    },
    onSuccess: () => {
      showToast({
        title: 'Pedido enviado',
        description: 'O usuario foi notificado sobre o convite de amizade.',
        tone: 'success',
      });
    },
    onError: (error) => {
      if (error instanceof FriendsRequestError && error.status === 409) {
        setLocalPending(true);
        showToast({
          title: 'Pedido ja existente',
          description: error.message,
          tone: 'info',
        });
        return;
      }

      setLocalPending(false);

      showToast({
        title: 'Nao foi possivel enviar o pedido',
        description: error instanceof FriendsRequestError
          ? error.message
          : 'Tente novamente em alguns instantes.',
        tone: 'error',
      });
    },
  });

  const acceptRequestMutation = useMutation({
    mutationFn: acceptFriendRequest,
    onMutate: async () => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: ['friends', currentUserId],
        }),
        queryClient.cancelQueries({
          queryKey: ['friend-requests', currentUserId],
        }),
        queryClient.cancelQueries({
          queryKey: ['profile'],
        }),
      ]);

      const snapshots = snapshotQueryGroups(queryClient, [
        ['friends', currentUserId],
        ['friend-requests', currentUserId],
        ['profile'],
      ]);

      if (currentUserId && incomingRequest) {
        applyAcceptedFriendRequest(
          queryClient,
          currentUserId,
          incomingRequest,
          buildOptimisticFriendSummary(queryClient, {
            id: currentUserId,
            username: user?.username ?? '',
          }),
        );
        applyProfileFriendCountDelta(queryClient, [currentUserId, targetUserId], 1);
      }

      setLocalPending(false);

      return { snapshots };
    },
    onSuccess: () => {
      showToast({
        title: 'Amizade confirmada',
        description: 'A amizade foi aceita com sucesso.',
        tone: 'success',
      });
    },
    onError: (error, _requestId, context) => {
      if (context) {
        restoreQuerySnapshots(queryClient, context.snapshots);
      }

      showToast({
        title: 'Nao foi possivel aceitar o pedido',
        description: error instanceof FriendsRequestError
          ? error.message
          : 'Tente novamente em alguns instantes.',
        tone: 'error',
      });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['profile'],
        refetchType: 'active',
      });
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: removeFriend,
    onMutate: async () => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: ['friends', currentUserId],
        }),
        queryClient.cancelQueries({
          queryKey: ['friends', targetUserId],
        }),
        queryClient.cancelQueries({
          queryKey: ['profile'],
        }),
      ]);

      const snapshots = snapshotQueryGroups(queryClient, [
        ['friends', currentUserId],
        ['friends', targetUserId],
        ['profile'],
      ]);

      if (currentUserId) {
        applyRemovedFriend(queryClient, currentUserId, targetUserId);
        applyProfileFriendCountDelta(queryClient, [currentUserId, targetUserId], -1);
      }

      setLocalPending(false);

      return { snapshots };
    },
    onSuccess: () => {
      showToast({
        title: 'Amizade removida',
        description: 'O perfil voltou a ficar fora da sua lista de amigos.',
        tone: 'success',
      });
    },
    onError: (error, _friendId, context) => {
      if (context) {
        restoreQuerySnapshots(queryClient, context.snapshots);
      }

      showToast({
        title: 'Nao foi possivel remover a amizade',
        description: error instanceof FriendsRequestError
          ? error.message
          : 'Tente novamente em alguns instantes.',
        tone: 'error',
      });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['profile'],
        refetchType: 'active',
      });
    },
  });

  const activeError =
    sendRequestMutation.error ??
    acceptRequestMutation.error ??
    removeFriendMutation.error;
  const serverError = activeError instanceof FriendsRequestError
    ? activeError.message
    : activeError
      ? 'Nao foi possivel atualizar a amizade agora.'
      : null;

  const isBusy =
    sendRequestMutation.isPending ||
    acceptRequestMutation.isPending ||
    removeFriendMutation.isPending;

  if (status !== 'authenticated' || !currentUserId) {
    return null;
  }

  if (currentUserId === targetUserId) {
    return (
      <Button disabled>
        Seu perfil
      </Button>
    );
  }

  if (friendsQuery.isPending || pendingRequestsQuery.isPending) {
    return (
      <Button disabled>
        Carregando amizade...
      </Button>
    );
  }

  if (friendsQuery.isError || pendingRequestsQuery.isError) {
    return (
      <div className="space-y-2">
        <Button variant="secondary" disabled>
          Amizade indisponivel
        </Button>
        <p role="alert" className="text-sm text-status-afk">
          Nao foi possivel resolver o estado de amizade agora.
        </p>
      </div>
    );
  }

  if (incomingRequest) {
    return (
      <div className="space-y-2">
        <Button
          disabled={isBusy}
          onClick={() => {
            acceptRequestMutation.mutate(incomingRequest.id);
          }}
        >
          {acceptRequestMutation.isPending ? 'Aceitando...' : 'Aceitar pedido'}
        </Button>
        {serverError ? (
          <p role="alert" className="text-sm text-status-afk">
            {serverError}
          </p>
        ) : null}
      </div>
    );
  }

  if (isFriend) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled>
          Amigos
        </Button>
        <Button
          variant="ghost"
          disabled={isBusy}
          onClick={() => {
            removeFriendMutation.mutate(targetUserId);
          }}
        >
          {removeFriendMutation.isPending ? 'Removendo...' : 'Remover'}
        </Button>
        {serverError ? (
          <p role="alert" className="w-full text-sm text-status-afk">
            {serverError}
          </p>
        ) : null}
      </div>
    );
  }

  if (localPending) {
    return (
      <Button variant="secondary" disabled>
        Pedido enviado
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        disabled={isBusy}
        onClick={() => {
          sendRequestMutation.mutate(targetUserId);
        }}
      >
        {sendRequestMutation.isPending ? 'Enviando...' : 'Adicionar amigo'}
      </Button>
      {serverError ? (
        <p role="alert" className="text-sm text-status-afk">
          {serverError}
        </p>
      ) : null}
    </div>
  );
}
