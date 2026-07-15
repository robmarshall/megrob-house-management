import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { sql, eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { user, shoppingLists, shoppingListItems } from '../db/schema.js';
import { addOrMergeItem } from './shoppingListItemService.js';

/**
 * DB-backed integration test proving the add-or-merge race condition is fixed.
 *
 * Wired to the dedicated test database via vitest.config.ts (test.env sets
 * DATABASE_URL before any module loads, so the singleton `db` connects there).
 * `fileParallelism: false` is set so DB suites don't race each other.
 */

// Unique per-run suffix so fixtures never collide with other data / runs.
const RUN = `slitest_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

const OWNER = `${RUN}_owner`;

// Captured fixture IDs (serial PKs) populated during setup.
let listId: number;

async function cleanup() {
  // FK-safe: TRUNCATE CASCADE clears dependents (shopping_list_items,
  // shopping_lists) regardless of ON DELETE rules.
  await db.execute(
    sql`TRUNCATE TABLE ${shoppingListItems}, ${shoppingLists}, ${user} RESTART IDENTITY CASCADE`
  );
}

beforeEach(async () => {
  await cleanup();

  await db.insert(user).values([
    {
      id: OWNER,
      name: 'Owner',
      email: `${OWNER}@example.test`,
      emailVerified: true,
    },
  ]);

  // Personal list (householdId null) owned by OWNER — enough to hold items.
  const [list] = await db
    .insert(shoppingLists)
    .values({
      name: `${RUN}_list`,
      householdId: null,
      createdBy: OWNER,
      updatedBy: OWNER,
    })
    .returning();

  listId = list.id;
});

afterAll(async () => {
  await cleanup();
});

async function itemsNamed(name: string) {
  return db
    .select()
    .from(shoppingListItems)
    .where(eq(shoppingListItems.listId, listId))
    .orderBy(asc(shoppingListItems.position))
    .then((rows) => rows.filter((r) => r.name === name));
}

describe('addOrMergeItem — concurrency', () => {
  it('serializes N concurrent identical adds into exactly one merged item', async () => {
    const N = 5;

    // Fire N concurrent add-or-merge operations for the SAME item on the SAME
    // list. Under the unlocked read-modify-write this intermittently produces
    // multiple rows; with the advisory lock it is deterministically one.
    await Promise.all(
      Array.from({ length: N }, () =>
        addOrMergeItem({
          listId,
          name: 'Milk',
          unit: 'L',
          quantity: 1,
          createdBy: OWNER,
          updatedBy: OWNER,
        })
      )
    );

    const milk = await itemsNamed('Milk');
    expect(milk).toHaveLength(1);
    // All N quantities of 1 merged into the single row.
    expect(milk[0].quantity).toBe(String(N));
  });
});

describe('addOrMergeItem — happy path', () => {
  it('does not falsely merge genuinely different items', async () => {
    await addOrMergeItem({
      listId,
      name: 'Milk',
      unit: 'L',
      quantity: 1,
      createdBy: OWNER,
      updatedBy: OWNER,
    });
    await addOrMergeItem({
      listId,
      name: 'Bread',
      unit: null,
      quantity: 1,
      createdBy: OWNER,
      updatedBy: OWNER,
    });

    const all = await db
      .select()
      .from(shoppingListItems)
      .where(eq(shoppingListItems.listId, listId));

    expect(all).toHaveLength(2);
    expect(all.map((r) => r.name).sort()).toEqual(['Bread', 'Milk']);
  });

  it('merges a second add of the same item (quantity increments)', async () => {
    const first = await addOrMergeItem({
      listId,
      name: 'Milk',
      unit: 'L',
      quantity: 2,
      createdBy: OWNER,
      updatedBy: OWNER,
    });
    expect(first.merged).toBe(false);

    const second = await addOrMergeItem({
      listId,
      name: 'Milk',
      unit: 'L',
      quantity: 3,
      createdBy: OWNER,
      updatedBy: OWNER,
    });
    expect(second.merged).toBe(true);
    expect(second.previousQuantity).toBe('2');

    const milk = await itemsNamed('Milk');
    expect(milk).toHaveLength(1);
    expect(milk[0].quantity).toBe('5');
  });
});
