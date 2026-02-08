import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  UserGroupIcon,
  EnvelopeIcon,
  TrashIcon,
  ArrowRightOnRectangleIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { MainLayout } from '@/components/templates/MainLayout';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Card } from '@/components/atoms/Card';
import BottomSheet from '@/components/atoms/BottomSheet';
import { useAuth } from '@/hooks/useAuth';
import {
  useHousehold,
  useHouseholdInvitations,
  useHouseholdActions,
} from '@/hooks/household/useHousehold';
import type { HouseholdMember } from '@/types/household';

const createHouseholdSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

type CreateHouseholdForm = z.infer<typeof createHouseholdSchema>;
type InviteForm = z.infer<typeof inviteSchema>;

export function HouseholdPage() {
  const { user } = useAuth();
  const { household, isLoading } = useHousehold();
  const { invitations } = useHouseholdInvitations();
  const actions = useHouseholdActions();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<HouseholdMember | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const createMethods = useForm<CreateHouseholdForm>({
    resolver: zodResolver(createHouseholdSchema),
    defaultValues: { name: '' },
  });

  const inviteMethods = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '' },
  });

  const handleCreate = async (data: CreateHouseholdForm) => {
    try {
      await actions.createHousehold(data);
      createMethods.reset();
      setIsCreateOpen(false);
    } catch {
      // toast handled by hook
    }
  };

  const handleInvite = async (data: InviteForm) => {
    try {
      await actions.inviteMember(data);
      inviteMethods.reset();
      setIsInviteOpen(false);
    } catch {
      // toast handled by hook
    }
  };

  const handleJoin = async (invitationId: number) => {
    try {
      await actions.joinHousehold(invitationId);
    } catch {
      // toast handled by hook
    }
  };

  const handleDecline = async (invitationId: number) => {
    try {
      await actions.declineInvitation(invitationId);
    } catch {
      // toast handled by hook
    }
  };

  const handleRemoveMember = async () => {
    if (!confirmRemove) return;
    try {
      await actions.removeMember(confirmRemove.userId);
      setConfirmRemove(null);
    } catch {
      // toast handled by hook
    }
  };

  const handleLeave = async () => {
    try {
      await actions.leaveHousehold();
      setConfirmLeave(false);
    } catch {
      // toast handled by hook
    }
  };

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    try {
      await actions.updateHousehold({ name: editName.trim() });
      setIsEditing(false);
    } catch {
      // toast handled by hook
    }
  };

  const handleCancelInvitation = async (invitationId: number) => {
    try {
      await actions.cancelInvitation(invitationId);
    } catch {
      // toast handled by hook
    }
  };

  const isOwner = household?.members.some(
    (m) => m.userId === user?.id && m.role === 'owner'
  );

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <svg
              className="animate-spin h-8 w-8 text-primary-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm text-gray-600">Loading household...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // No household - show create/join UI
  if (!household) {
    return (
      <MainLayout>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Household</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create or join a household to share shopping lists and recipes with family
          </p>
        </div>

        {/* Pending invitations */}
        {invitations.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Invitations</h2>
            <div className="space-y-3">
              {invitations.map((inv) => (
                <Card key={inv.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{inv.householdName}</p>
                      <p className="text-sm text-gray-500">Invited by {inv.invitedByName}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleJoin(inv.id)}
                        disabled={actions.isLoading}
                      >
                        Join
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDecline(inv.id)}
                        disabled={actions.isLoading}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <Card>
          <div className="text-center py-8">
            <UserGroupIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              No Household Yet
            </h2>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Create a household to share shopping lists and recipes with your family members.
              You can invite others after creating one.
            </p>
            <Button
              variant="primary"
              onClick={() => setIsCreateOpen(true)}
            >
              Create Household
            </Button>
          </div>
        </Card>

        <BottomSheet
          isOpen={isCreateOpen}
          onClose={() => { setIsCreateOpen(false); createMethods.reset(); }}
          title="Create Household"
        >
          <FormProvider {...createMethods}>
            <form onSubmit={createMethods.handleSubmit(handleCreate)} className="flex flex-col gap-4">
              <Input
                name="name"
                label="Household Name"
                placeholder="e.g., The Smith Family"
                required
              />
              <Button
                type="submit"
                variant="primary"
                isLoading={createMethods.formState.isSubmitting}
                className="w-full"
              >
                Create
              </Button>
            </form>
          </FormProvider>
        </BottomSheet>
      </MainLayout>
    );
  }

  // Has household - show management UI
  return (
    <MainLayout>
      <div className="mb-8">
        <div className="flex items-center gap-3">
          {isEditing ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-3xl font-bold text-gray-900 border-b-2 border-primary-500 outline-none bg-transparent flex-1"
                autoFocus
              />
              <button
                onClick={handleSaveName}
                className="p-1 text-green-600 hover:text-green-700"
                aria-label="Save name"
              >
                <CheckIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
                aria-label="Cancel editing"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-900">{household.name}</h1>
              {isOwner && (
                <button
                  onClick={() => { setEditName(household.name); setIsEditing(true); }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  aria-label="Edit household name"
                >
                  <PencilIcon className="w-5 h-5" />
                </button>
              )}
            </>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {household.members.length} member{household.members.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Members */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Members</h2>
        <div className="space-y-3">
          {household.members.map((member) => (
            <Card key={member.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-700 font-semibold text-sm">
                      {member.userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {member.userName}
                      {member.userId === user?.id && (
                        <span className="text-gray-400 text-sm ml-1">(you)</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">{member.userEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    member.role === 'owner'
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {member.role}
                  </span>
                  {isOwner && member.userId !== user?.id && (
                    <button
                      onClick={() => setConfirmRemove(member)}
                      className="p-1 text-red-400 hover:text-red-600"
                      aria-label={`Remove ${member.userName}`}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Pending Invitations (owner only) */}
      {isOwner && household.pendingInvitations.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Invitations</h2>
          <div className="space-y-3">
            {household.pendingInvitations.map((inv) => (
              <Card key={inv.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <EnvelopeIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{inv.email}</p>
                      <p className="text-xs text-gray-500">
                        Expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancelInvitation(inv.id)}
                    className="text-sm text-red-600 hover:text-red-700"
                    disabled={actions.isLoading}
                  >
                    Cancel
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Actions */}
      <section className="space-y-3">
        {isOwner && (
          <Button
            variant="primary"
            onClick={() => setIsInviteOpen(true)}
            className="w-full sm:w-auto"
          >
            <EnvelopeIcon className="w-5 h-5 mr-2" />
            Invite Member
          </Button>
        )}

        <Button
          variant="danger"
          onClick={() => setConfirmLeave(true)}
          className="w-full sm:w-auto"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2" />
          Leave Household
        </Button>
      </section>

      {/* Invite Bottom Sheet */}
      <BottomSheet
        isOpen={isInviteOpen}
        onClose={() => { setIsInviteOpen(false); inviteMethods.reset(); }}
        title="Invite Member"
      >
        <FormProvider {...inviteMethods}>
          <form onSubmit={inviteMethods.handleSubmit(handleInvite)} className="flex flex-col gap-4">
            <Input
              name="email"
              label="Email Address"
              type="email"
              placeholder="name@example.com"
              required
            />
            <p className="text-sm text-gray-500">
              The person must already have an account. They&apos;ll see the invitation when they log in.
            </p>
            <Button
              type="submit"
              variant="primary"
              isLoading={inviteMethods.formState.isSubmitting}
              className="w-full"
            >
              Send Invitation
            </Button>
          </form>
        </FormProvider>
      </BottomSheet>

      {/* Remove Member Confirmation */}
      <BottomSheet
        isOpen={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title="Remove Member"
      >
        <div className="flex flex-col gap-4">
          <p className="text-gray-700">
            Are you sure you want to remove <strong>{confirmRemove?.userName}</strong> from the household?
            They will no longer have access to shared shopping lists and recipes.
          </p>
          <div className="flex gap-3">
            <Button
              variant="danger"
              onClick={handleRemoveMember}
              isLoading={actions.isLoading}
              className="flex-1"
            >
              Remove
            </Button>
            <Button
              variant="secondary"
              onClick={() => setConfirmRemove(null)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Leave Confirmation */}
      <BottomSheet
        isOpen={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Leave Household"
      >
        <div className="flex flex-col gap-4">
          <p className="text-gray-700">
            {isOwner
              ? 'As the owner, you must remove all other members before leaving. If you are the only member, the household will be deleted.'
              : `Are you sure you want to leave "${household.name}"? You will no longer have access to shared data.`
            }
          </p>
          <div className="flex gap-3">
            <Button
              variant="danger"
              onClick={handleLeave}
              isLoading={actions.isLoading}
              className="flex-1"
            >
              Leave
            </Button>
            <Button
              variant="secondary"
              onClick={() => setConfirmLeave(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </BottomSheet>
    </MainLayout>
  );
}
