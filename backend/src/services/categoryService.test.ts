import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  user,
  households,
  householdMembers,
  itemCategoryMemory,
} from '../db/schema.js';
import {
  resolveItemCategories,
  rememberItemCategory,
} from './categoryService.js';

/**
 * DB-backed tests for learned category memory: household/personal scoping,
 * upsert-on-correction, and resolution order (memory > dictionary > null).
 */

const RUN = `catmem_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const HH_USER = `${RUN}_hh_user`;
const HH_USER_2 = `${RUN}_hh_user2`;
const SOLO_USER = `${RUN}_solo_user`;

let householdId: number;

async function cleanup() {
  await db.execute(
    sql`TRUNCATE TABLE ${itemCategoryMemory}, ${households}, ${user} RESTART IDENTITY CASCADE`
  );
}

beforeEach(async () => {
  await cleanup();

  await db.insert(user).values([
    { id: HH_USER, name: 'H1', email: `${HH_USER}@e.test`, emailVerified: true },
    { id: HH_USER_2, name: 'H2', email: `${HH_USER_2}@e.test`, emailVerified: true },
    { id: SOLO_USER, name: 'S', email: `${SOLO_USER}@e.test`, emailVerified: true },
  ]);

  const [hh] = await db
    .insert(households)
    .values({ name: `${RUN}_hh`, createdBy: HH_USER })
    .returning();
  householdId = hh.id;
  await db.insert(householdMembers).values([
    { householdId, userId: HH_USER, role: 'owner' },
    { householdId, userId: HH_USER_2, role: 'member' },
  ]);
});

afterAll(async () => {
  await cleanup();
});

describe('resolveItemCategories', () => {
  it('leaves explicitly provided categories untouched', async () => {
    const items = await resolveItemCategories(HH_USER, [
      { name: 'milk', category: 'other' },
    ]);
    expect(items[0].category).toBe('other');
  });

  it('falls back to the keyword dictionary when nothing is learned', async () => {
    const items = await resolveItemCategories(HH_USER, [
      { name: 'milk' },
      { name: 'mystery thing' },
    ]);
    expect(items[0].category).toBe('dairy');
    expect(items[1].category).toBeUndefined();
  });

  it('prefers learned memory over the dictionary', async () => {
    // "oat milk" hits dairy in the dictionary; the household prefers beverages.
    await rememberItemCategory(HH_USER, 'oat milk', 'beverages');

    const items = await resolveItemCategories(HH_USER, [{ name: 'Oat Milk' }]);
    expect(items[0].category).toBe('beverages');
  });

  it('shares learned memory across household members', async () => {
    await rememberItemCategory(HH_USER, 'protein powder', 'medicine');

    const items = await resolveItemCategories(HH_USER_2, [
      { name: 'protein powder' },
    ]);
    expect(items[0].category).toBe('medicine');
  });

  it('does not leak household memory to unrelated users', async () => {
    await rememberItemCategory(HH_USER, 'protein powder', 'medicine');

    const items = await resolveItemCategories(SOLO_USER, [
      { name: 'protein powder' },
    ]);
    expect(items[0].category).toBeUndefined();
  });

  it('matches learned names across singular/plural forms', async () => {
    // "vape coils" is not in the dictionary, so a match proves memory lookup
    // normalizes the same way rememberItemCategory does.
    await rememberItemCategory(HH_USER, 'vape coils', 'other');

    const items = await resolveItemCategories(HH_USER, [{ name: 'Vape Coil' }]);
    expect(items[0].category).toBe('other');
  });
});

describe('rememberItemCategory', () => {
  it('upserts: a correction replaces the previous preference', async () => {
    await rememberItemCategory(HH_USER, 'oat milk', 'dairy');
    await rememberItemCategory(HH_USER_2, 'oat milk', 'beverages');

    const rows = await db.select().from(itemCategoryMemory);
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe('beverages');
    expect(rows[0].householdId).toBe(householdId);
  });

  it('scopes memory to the user when they have no household', async () => {
    await rememberItemCategory(SOLO_USER, 'oat milk', 'beverages');
    await rememberItemCategory(SOLO_USER, 'oat milk', 'dairy');

    const rows = await db.select().from(itemCategoryMemory);
    expect(rows).toHaveLength(1);
    expect(rows[0].householdId).toBeNull();
    expect(rows[0].userId).toBe(SOLO_USER);
    expect(rows[0].category).toBe('dairy');

    const items = await resolveItemCategories(SOLO_USER, [{ name: 'oat milk' }]);
    expect(items[0].category).toBe('dairy');
  });

  it('ignores empty and default categories', async () => {
    await rememberItemCategory(HH_USER, 'milk', '');
    await rememberItemCategory(HH_USER, 'milk', 'default');

    const rows = await db.select().from(itemCategoryMemory);
    expect(rows).toHaveLength(0);
  });
});
