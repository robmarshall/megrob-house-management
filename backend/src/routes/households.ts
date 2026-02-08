import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { households, householdMembers, householdInvitations, user } from '../db/schema.js';
import { authMiddleware, getUserId } from '../middleware/auth.js';
import { validateBody, getValidatedBody } from '../middleware/validation.js';
import { logger } from '../lib/logger.js';
import { getUserHouseholdId } from '../lib/household.js';
import {
  createHouseholdSchema,
  inviteMemberSchema,
  type CreateHouseholdInput,
  type InviteMemberInput,
} from '../lib/validation.js';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

/**
 * GET /api/households/current
 * Get the current user's household with members
 */
app.get('/current', async (c) => {
  const userId = getUserId(c);

  try {
    const householdId = await getUserHouseholdId(userId);

    if (!householdId) {
      return c.json({ household: null });
    }

    // Get household details
    const [household] = await db
      .select()
      .from(households)
      .where(eq(households.id, householdId));

    if (!household) {
      return c.json({ household: null });
    }

    // Get members with user details
    const members = await db
      .select({
        id: householdMembers.id,
        userId: householdMembers.userId,
        role: householdMembers.role,
        joinedAt: householdMembers.joinedAt,
        userName: user.name,
        userEmail: user.email,
      })
      .from(householdMembers)
      .innerJoin(user, eq(householdMembers.userId, user.id))
      .where(eq(householdMembers.householdId, householdId));

    // Get pending invitations (only if user is owner)
    const [currentMember] = await db
      .select()
      .from(householdMembers)
      .where(and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId)
      ));

    let pendingInvitations: (typeof householdInvitations.$inferSelect)[] = [];
    if (currentMember?.role === 'owner') {
      pendingInvitations = await db
        .select()
        .from(householdInvitations)
        .where(and(
          eq(householdInvitations.householdId, householdId),
          eq(householdInvitations.status, 'pending')
        ))
        .orderBy(desc(householdInvitations.createdAt));
    }

    return c.json({
      household: {
        ...household,
        members,
        pendingInvitations,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Error fetching household");
    return c.json({ error: 'Failed to fetch household' }, 500);
  }
});

/**
 * POST /api/households
 * Create a new household (user must not already belong to one)
 */
app.post('/', validateBody(createHouseholdSchema), async (c) => {
  const userId = getUserId(c);
  const { name } = getValidatedBody<CreateHouseholdInput>(c);

  try {
    // Check if user already belongs to a household
    const existingHouseholdId = await getUserHouseholdId(userId);
    if (existingHouseholdId) {
      return c.json({ error: 'You already belong to a household. Leave it first to create a new one.' }, 400);
    }

    // Create household and add user as owner in a transaction
    const result = await db.transaction(async (tx) => {
      const [newHousehold] = await tx
        .insert(households)
        .values({
          name,
          createdBy: userId,
        })
        .returning();

      await tx
        .insert(householdMembers)
        .values({
          householdId: newHousehold.id,
          userId,
          role: 'owner',
        });

      return newHousehold;
    });

    return c.json(result, 201);
  } catch (error) {
    logger.error({ err: error }, "Error creating household");
    return c.json({ error: 'Failed to create household' }, 500);
  }
});

/**
 * PATCH /api/households/current
 * Update household name (owner only)
 */
app.patch('/current', validateBody(createHouseholdSchema), async (c) => {
  const userId = getUserId(c);
  const { name } = getValidatedBody<CreateHouseholdInput>(c);

  try {
    const householdId = await getUserHouseholdId(userId);
    if (!householdId) {
      return c.json({ error: 'You do not belong to a household' }, 404);
    }

    // Verify ownership
    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId)
      ));

    if (membership?.role !== 'owner') {
      return c.json({ error: 'Only the household owner can update it' }, 403);
    }

    const [updated] = await db
      .update(households)
      .set({ name })
      .where(eq(households.id, householdId))
      .returning();

    return c.json(updated);
  } catch (error) {
    logger.error({ err: error }, "Error updating household");
    return c.json({ error: 'Failed to update household' }, 500);
  }
});

/**
 * POST /api/households/invite
 * Invite a member by email (owner only)
 */
app.post('/invite', validateBody(inviteMemberSchema), async (c) => {
  const userId = getUserId(c);
  const { email } = getValidatedBody<InviteMemberInput>(c);

  try {
    const householdId = await getUserHouseholdId(userId);
    if (!householdId) {
      return c.json({ error: 'You do not belong to a household' }, 404);
    }

    // Verify ownership
    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId)
      ));

    if (membership?.role !== 'owner') {
      return c.json({ error: 'Only the household owner can invite members' }, 403);
    }

    // Check if user with this email is already a member
    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, email));

    if (existingUser) {
      const [existingMembership] = await db
        .select()
        .from(householdMembers)
        .where(eq(householdMembers.userId, existingUser.id));

      if (existingMembership?.householdId === householdId) {
        return c.json({ error: 'This user is already a member of your household' }, 400);
      }
      if (existingMembership) {
        return c.json({ error: 'This user already belongs to another household' }, 400);
      }
    }

    // Check for existing pending invitation
    const [existingInvitation] = await db
      .select()
      .from(householdInvitations)
      .where(and(
        eq(householdInvitations.householdId, householdId),
        eq(householdInvitations.email, email),
        eq(householdInvitations.status, 'pending')
      ));

    if (existingInvitation) {
      return c.json({ error: 'An invitation has already been sent to this email' }, 400);
    }

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [invitation] = await db
      .insert(householdInvitations)
      .values({
        householdId,
        email,
        invitedBy: userId,
        expiresAt,
      })
      .returning();

    return c.json(invitation, 201);
  } catch (error) {
    logger.error({ err: error }, "Error inviting member");
    return c.json({ error: 'Failed to invite member' }, 500);
  }
});

/**
 * GET /api/households/invitations
 * Get pending invitations for the current user (by their email)
 */
app.get('/invitations', async (c) => {
  const userId = getUserId(c);

  try {
    // Get the user's email
    const [currentUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId));

    if (!currentUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Find pending invitations for this email
    const invitations = await db
      .select({
        id: householdInvitations.id,
        householdId: householdInvitations.householdId,
        email: householdInvitations.email,
        status: householdInvitations.status,
        createdAt: householdInvitations.createdAt,
        expiresAt: householdInvitations.expiresAt,
        householdName: households.name,
        invitedByName: user.name,
      })
      .from(householdInvitations)
      .innerJoin(households, eq(householdInvitations.householdId, households.id))
      .innerJoin(user, eq(householdInvitations.invitedBy, user.id))
      .where(and(
        eq(householdInvitations.email, currentUser.email),
        eq(householdInvitations.status, 'pending')
      ))
      .orderBy(desc(householdInvitations.createdAt));

    return c.json({ invitations });
  } catch (error) {
    logger.error({ err: error }, "Error fetching invitations");
    return c.json({ error: 'Failed to fetch invitations' }, 500);
  }
});

/**
 * POST /api/households/join/:invitationId
 * Accept an invitation and join a household
 */
app.post('/join/:invitationId', async (c) => {
  const userId = getUserId(c);
  const invitationId = parseInt(c.req.param('invitationId'));

  if (isNaN(invitationId)) {
    return c.json({ error: 'Invalid invitation ID' }, 400);
  }

  try {
    // Check if user already belongs to a household
    const existingHouseholdId = await getUserHouseholdId(userId);
    if (existingHouseholdId) {
      return c.json({ error: 'You already belong to a household. Leave it first to join another.' }, 400);
    }

    // Get the user's email
    const [currentUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId));

    if (!currentUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Find the invitation
    const [invitation] = await db
      .select()
      .from(householdInvitations)
      .where(and(
        eq(householdInvitations.id, invitationId),
        eq(householdInvitations.email, currentUser.email),
        eq(householdInvitations.status, 'pending')
      ));

    if (!invitation) {
      return c.json({ error: 'Invitation not found or already used' }, 404);
    }

    // Check if invitation has expired
    if (new Date() > invitation.expiresAt) {
      await db
        .update(householdInvitations)
        .set({ status: 'declined' })
        .where(eq(householdInvitations.id, invitationId));
      return c.json({ error: 'This invitation has expired' }, 400);
    }

    // Join household in a transaction
    await db.transaction(async (tx) => {
      // Add user as member
      await tx
        .insert(householdMembers)
        .values({
          householdId: invitation.householdId,
          userId,
          role: 'member',
        });

      // Mark invitation as accepted
      await tx
        .update(householdInvitations)
        .set({ status: 'accepted' })
        .where(eq(householdInvitations.id, invitationId));
    });

    return c.json({ message: 'Successfully joined household' });
  } catch (error) {
    logger.error({ err: error }, "Error joining household");
    return c.json({ error: 'Failed to join household' }, 500);
  }
});

/**
 * POST /api/households/decline/:invitationId
 * Decline an invitation
 */
app.post('/decline/:invitationId', async (c) => {
  const userId = getUserId(c);
  const invitationId = parseInt(c.req.param('invitationId'));

  if (isNaN(invitationId)) {
    return c.json({ error: 'Invalid invitation ID' }, 400);
  }

  try {
    // Get the user's email
    const [currentUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId));

    if (!currentUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Find and decline the invitation
    const [invitation] = await db
      .select()
      .from(householdInvitations)
      .where(and(
        eq(householdInvitations.id, invitationId),
        eq(householdInvitations.email, currentUser.email),
        eq(householdInvitations.status, 'pending')
      ));

    if (!invitation) {
      return c.json({ error: 'Invitation not found or already used' }, 404);
    }

    await db
      .update(householdInvitations)
      .set({ status: 'declined' })
      .where(eq(householdInvitations.id, invitationId));

    return c.json({ message: 'Invitation declined' });
  } catch (error) {
    logger.error({ err: error }, "Error declining invitation");
    return c.json({ error: 'Failed to decline invitation' }, 500);
  }
});

/**
 * DELETE /api/households/members/:userId
 * Remove a member from the household (owner only)
 */
app.delete('/members/:memberId', async (c) => {
  const userId = getUserId(c);
  const targetUserId = c.req.param('memberId');

  try {
    const householdId = await getUserHouseholdId(userId);
    if (!householdId) {
      return c.json({ error: 'You do not belong to a household' }, 404);
    }

    // Verify ownership
    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId)
      ));

    if (membership?.role !== 'owner') {
      return c.json({ error: 'Only the household owner can remove members' }, 403);
    }

    // Can't remove yourself (use leave instead)
    if (targetUserId === userId) {
      return c.json({ error: 'Cannot remove yourself. Use leave instead.' }, 400);
    }

    // Verify target is a member of this household
    const [targetMembership] = await db
      .select()
      .from(householdMembers)
      .where(and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, targetUserId)
      ));

    if (!targetMembership) {
      return c.json({ error: 'User is not a member of this household' }, 404);
    }

    await db
      .delete(householdMembers)
      .where(and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, targetUserId)
      ));

    return c.json({ message: 'Member removed successfully' });
  } catch (error) {
    logger.error({ err: error }, "Error removing member");
    return c.json({ error: 'Failed to remove member' }, 500);
  }
});

/**
 * POST /api/households/leave
 * Leave the current household
 */
app.post('/leave', async (c) => {
  const userId = getUserId(c);

  try {
    const householdId = await getUserHouseholdId(userId);
    if (!householdId) {
      return c.json({ error: 'You do not belong to a household' }, 404);
    }

    // Check if user is owner
    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId)
      ));

    if (membership?.role === 'owner') {
      // Count other members
      const otherMembers = await db
        .select()
        .from(householdMembers)
        .where(eq(householdMembers.householdId, householdId));

      if (otherMembers.length > 1) {
        return c.json({
          error: 'As the owner, you must remove all other members before leaving, or transfer ownership first.',
        }, 400);
      }

      // Owner is the only member - delete the household
      await db.transaction(async (tx) => {
        await tx
          .delete(householdMembers)
          .where(eq(householdMembers.userId, userId));
        await tx
          .delete(householdInvitations)
          .where(eq(householdInvitations.householdId, householdId));
        await tx
          .delete(households)
          .where(eq(households.id, householdId));
      });
    } else {
      // Regular member - just remove membership
      await db
        .delete(householdMembers)
        .where(and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, userId)
        ));
    }

    return c.json({ message: 'Successfully left household' });
  } catch (error) {
    logger.error({ err: error }, "Error leaving household");
    return c.json({ error: 'Failed to leave household' }, 500);
  }
});

/**
 * DELETE /api/households/invitations/:invitationId
 * Cancel a pending invitation (owner only)
 */
app.delete('/invitations/:invitationId', async (c) => {
  const userId = getUserId(c);
  const invitationId = parseInt(c.req.param('invitationId'));

  if (isNaN(invitationId)) {
    return c.json({ error: 'Invalid invitation ID' }, 400);
  }

  try {
    const householdId = await getUserHouseholdId(userId);
    if (!householdId) {
      return c.json({ error: 'You do not belong to a household' }, 404);
    }

    // Verify ownership
    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId)
      ));

    if (membership?.role !== 'owner') {
      return c.json({ error: 'Only the household owner can cancel invitations' }, 403);
    }

    // Find and delete the invitation
    const [invitation] = await db
      .select()
      .from(householdInvitations)
      .where(and(
        eq(householdInvitations.id, invitationId),
        eq(householdInvitations.householdId, householdId),
        eq(householdInvitations.status, 'pending')
      ));

    if (!invitation) {
      return c.json({ error: 'Invitation not found' }, 404);
    }

    await db
      .delete(householdInvitations)
      .where(eq(householdInvitations.id, invitationId));

    return c.json({ message: 'Invitation cancelled' });
  } catch (error) {
    logger.error({ err: error }, "Error cancelling invitation");
    return c.json({ error: 'Failed to cancel invitation' }, 500);
  }
});

export default app;
