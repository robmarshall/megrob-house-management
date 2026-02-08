/**
 * Household types for the sharing & collaboration feature (Spec 009)
 */

export interface Household {
  id: number;
  name: string;
  createdBy: string;
  createdAt: string;
}

export interface HouseholdMember {
  id: number;
  userId: string;
  role: 'owner' | 'member';
  joinedAt: string;
  userName: string;
  userEmail: string;
}

export interface HouseholdInvitation {
  id: number;
  householdId: number;
  email: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  expiresAt: string;
  // Present on incoming invitations
  householdName?: string;
  invitedByName?: string;
}

export interface HouseholdWithDetails extends Household {
  members: HouseholdMember[];
  pendingInvitations: HouseholdInvitation[];
}

export interface HouseholdResponse {
  household: HouseholdWithDetails | null;
}

export interface InvitationsResponse {
  invitations: HouseholdInvitation[];
}

export interface CreateHouseholdInput {
  name: string;
}

export interface InviteMemberInput {
  email: string;
}
