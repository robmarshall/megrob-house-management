/**
 * Household hooks for managing household data, invitations, and membership
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/client';
import { toast } from '@/lib/toast';
import type {
  HouseholdResponse,
  Household,
  HouseholdInvitation,
  InvitationsResponse,
} from '@/types/household';

const HOUSEHOLD_KEY = ['households', 'current'];
const INVITATIONS_KEY = ['households', 'invitations'];

/**
 * Hook for fetching the current user's household
 */
export function useHousehold() {
  const query = useQuery<HouseholdResponse>({
    queryKey: HOUSEHOLD_KEY,
    queryFn: () => apiGet<HouseholdResponse>('/api/households/current'),
  });

  return {
    household: query.data?.household ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook for fetching pending invitations for the current user
 */
export function useHouseholdInvitations() {
  const query = useQuery<InvitationsResponse>({
    queryKey: INVITATIONS_KEY,
    queryFn: () => apiGet<InvitationsResponse>('/api/households/invitations'),
  });

  return {
    invitations: query.data?.invitations ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook for household mutation operations
 */
export function useHouseholdActions() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: HOUSEHOLD_KEY });
    queryClient.invalidateQueries({ queryKey: INVITATIONS_KEY });
  };

  const createHousehold = useMutation({
    mutationFn: (data: { name: string }) =>
      apiPost<Household>('/api/households', data),
    onSuccess: () => {
      invalidate();
      toast.success('Household created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create household');
    },
  });

  const updateHousehold = useMutation({
    mutationFn: (data: { name: string }) =>
      apiPatch<Household>('/api/households/current', data),
    onSuccess: () => {
      invalidate();
      toast.success('Household updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update household');
    },
  });

  const inviteMember = useMutation({
    mutationFn: (data: { email: string }) =>
      apiPost<HouseholdInvitation>('/api/households/invite', data),
    onSuccess: () => {
      invalidate();
      toast.success('Invitation sent');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send invitation');
    },
  });

  const joinHousehold = useMutation({
    mutationFn: (invitationId: number) =>
      apiPost<{ message: string }>(`/api/households/join/${invitationId}`, {}),
    onSuccess: () => {
      invalidate();
      // Also invalidate shopping lists and recipes since scoping changed
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Joined household');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to join household');
    },
  });

  const declineInvitation = useMutation({
    mutationFn: (invitationId: number) =>
      apiPost<{ message: string }>(`/api/households/decline/${invitationId}`, {}),
    onSuccess: () => {
      invalidate();
      toast.success('Invitation declined');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to decline invitation');
    },
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      apiDelete<{ message: string }>(`/api/households/members/${userId}`),
    onSuccess: () => {
      invalidate();
      toast.success('Member removed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove member');
    },
  });

  const leaveHousehold = useMutation({
    mutationFn: () =>
      apiPost<{ message: string }>('/api/households/leave', {}),
    onSuccess: () => {
      invalidate();
      // Also invalidate data since scoping changed
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Left household');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to leave household');
    },
  });

  const cancelInvitation = useMutation({
    mutationFn: (invitationId: number) =>
      apiDelete<{ message: string }>(`/api/households/invitations/${invitationId}`),
    onSuccess: () => {
      invalidate();
      toast.success('Invitation cancelled');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to cancel invitation');
    },
  });

  return {
    createHousehold: createHousehold.mutateAsync,
    updateHousehold: updateHousehold.mutateAsync,
    inviteMember: inviteMember.mutateAsync,
    joinHousehold: joinHousehold.mutateAsync,
    declineInvitation: declineInvitation.mutateAsync,
    removeMember: removeMember.mutateAsync,
    leaveHousehold: leaveHousehold.mutateAsync,
    cancelInvitation: cancelInvitation.mutateAsync,
    isLoading:
      createHousehold.isPending ||
      updateHousehold.isPending ||
      inviteMember.isPending ||
      joinHousehold.isPending ||
      declineInvitation.isPending ||
      removeMember.isPending ||
      leaveHousehold.isPending ||
      cancelInvitation.isPending,
  };
}
