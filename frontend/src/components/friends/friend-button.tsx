'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
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

  const commonSuccessHandler = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['friends', currentUserId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['friend-requests', currentUserId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['profile'],
      }),
    ]);
  };

  const sendRequestMutation = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: async () => {
      setLocalPending(true);
      await commonSuccessHandler();
    },
    onError: (error) => {
      if (error instanceof FriendsRequestError && error.status === 409) {
        setLocalPending(true);
      }
    },
  });

  const acceptRequestMutation = useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: async () => {
      setLocalPending(false);
      await commonSuccessHandler();
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: removeFriend,
    onSuccess: async () => {
      setLocalPending(false);
      await commonSuccessHandler();
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
