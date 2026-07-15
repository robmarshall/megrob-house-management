import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  user,
  households,
  householdMembers,
  shoppingLists,
} from '../db/schema.js';
import { verifyShoppingListAccess } from './shoppingListAccess.js';

/**
 * DB-backed integration test proving the cross-household IDOR is closed.
 *
 * Wired to the dedicated test database via vitest.config.ts (test.env sets
 * DATABASE_URL before any module loads, so the singleton `db` connects there).
 */

// Unique per-run suffix so fixtures never collide with other data / runs.
const RUN = `slatest_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

const USER_A = `${RUN}_userA`;
const USER_B = `${RUN}_userB`;
const USER_C = `${RUN}_userC`; // household-less user (personal-only scope)

// Captured fixture IDs (serial PKs) populated during setup.
let householdAId: number;
let householdBId: number;
let listAId: number; // belongs to household A
let listBId: number; // belongs to household B
let personalListId: number; // householdId null, owned by USER_A

async function cleanup() {
  // FK-safe: TRUNCATE CASCADE clears dependents (household_members,
  // shopping_lists, households) regardless of ON DELETE rules.
  await db.execute(
    sql`TRUNCATE TABLE ${shoppingLists}, ${householdMembers}, ${households}, ${user} RESTART IDENTITY CASCADE`
  );
}

beforeEach(async () => {
  await cleanup();

  // Two users in two households, plus a household-less user.
  await db.insert(user).values([
    { id: USER_A, name: 'User A', email: `${USER_A}@example.test`, emailVerified: true },
    { id: USER_B, name: 'User B', email: `${USER_B}@example.test`, emailVerified: true },
    { id: USER_C, name: 'User C', email: `${USER_C}@example.test`, emailVerified: true },
  ]);

  const [hhA] = await db
    .insert(households)
    .values({ name: `${RUN}_householdA`, createdBy: USER_A })
    .returning();
  const [hhB] = await db
    .insert(households)
    .values({ name: `${RUN}_householdB`, createdBy: USER_B })
    .returning();
  householdAId = hhA.id;
  householdBId = hhB.id;

  await db.insert(householdMembers).values([
    { householdId: householdAId, userId: USER_A, role: 'owner' },
    { householdId: householdBId, userId: USER_B, role: 'owner' },
  ]);

  const [listA] = await db
    .insert(shoppingLists)
    .values({
      name: `${RUN}_listA`,
      householdId: householdAId,
      createdBy: USER_A,
      updatedBy: USER_A,
    })
    .returning();
  const [listB] = await db
    .insert(shoppingLists)
    .values({
      name: `${RUN}_listB`,
      householdId: householdBId,
      createdBy: USER_B,
      updatedBy: USER_B,
    })
    .returning();
  const [personalList] = await db
    .insert(shoppingLists)
    .values({
      name: `${RUN}_personalList`,
      householdId: null,
      createdBy: USER_A,
      updatedBy: USER_A,
    })
    .returning();

  listAId = listA.id;
  listBId = listB.id;
  personalListId = personalList.id;
});

afterAll(async () => {
  await cleanup();
});

describe('verifyShoppingListAccess', () => {
  it('lets a household member access a list belonging to their household', async () => {
    const list = await verifyShoppingListAccess(listAId, USER_A);
    expect(list).toBeDefined();
    expect(list?.id).toBe(listAId);
    expect(list?.householdId).toBe(householdAId);
  });

  it('closes the IDOR: a user in household A cannot access household B\'s list', async () => {
    const list = await verifyShoppingListAccess(listBId, USER_A);
    expect(list).toBeUndefined();
  });

  it('closes the IDOR in the other direction too', async () => {
    const list = await verifyShoppingListAccess(listAId, USER_B);
    expect(list).toBeUndefined();
  });

  it('scopes personal lists: the owner can access their personal list', async () => {
    const list = await verifyShoppingListAccess(personalListId, USER_A);
    expect(list).toBeDefined();
    expect(list?.id).toBe(personalListId);
    expect(list?.householdId).toBeNull();
  });

  it('scopes personal lists: another household user cannot access it', async () => {
    const list = await verifyShoppingListAccess(personalListId, USER_B);
    expect(list).toBeUndefined();
  });

  it('scopes personal lists: a household-less non-owner cannot access it', async () => {
    const list = await verifyShoppingListAccess(personalListId, USER_C);
    expect(list).toBeUndefined();
  });
});
