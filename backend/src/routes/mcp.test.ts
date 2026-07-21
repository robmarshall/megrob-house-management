import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  user,
  shoppingLists,
  shoppingListItems,
  recipes,
  recipeIngredients,
  recipeNutrition,
  nutritionProfiles,
  mealPlans,
  oauthApplication,
  oauthAccessToken,
} from '../db/schema.js';
import mcpRoutes from './mcp.js';

/**
 * DB-backed integration test for the MCP endpoint: bearer-token auth
 * (including the expiry check better-auth 1.4.18 omits) and the
 * list_shopping_lists tool end-to-end through the Streamable HTTP transport.
 *
 * Uses the dedicated test database via vitest.config.ts, same as the other
 * DB-backed suites.
 */

const RUN = `mcptest_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

const OWNER = `${RUN}_owner`;
const OTHER = `${RUN}_other`;
const CLIENT_ID = `${RUN}_client`;
const VALID_TOKEN = `${RUN}_valid_token`;
const EXPIRED_TOKEN = `${RUN}_expired_token`;

const HOUR = 60 * 60 * 1000;

/** JSON-RPC call helper against the mounted MCP sub-app. */
async function mcpRequest(body: unknown, token?: string) {
  return mcpRoutes.request('/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** Streamable HTTP responses may arrive as SSE; extract the JSON-RPC payload. */
async function readJsonRpc(res: Response): Promise<any> {
  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream')) {
    const dataLine = text
      .split('\n')
      .find((line) => line.startsWith('data: '));
    expect(dataLine, `no data line in SSE response: ${text}`).toBeDefined();
    return JSON.parse(dataLine!.slice('data: '.length));
  }
  return JSON.parse(text);
}

function toolCallBody(id: number) {
  return {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name: 'list_shopping_lists', arguments: {} },
  };
}

let rpcId = 100;

/** Call a tool with the valid token and return the parsed JSON payload (or raw result). */
async function callTool(name: string, args: Record<string, unknown>) {
  const res = await mcpRequest(
    {
      jsonrpc: '2.0',
      id: ++rpcId,
      method: 'tools/call',
      params: { name, arguments: args },
    },
    VALID_TOKEN
  );
  expect(res.status).toBe(200);
  const rpc = await readJsonRpc(res);
  expect(rpc.error, JSON.stringify(rpc.error)).toBeUndefined();
  return rpc.result;
}

function parsePayload(result: any) {
  return JSON.parse(result.content[0].text);
}

async function cleanup() {
  await db.execute(
    sql`TRUNCATE TABLE ${oauthAccessToken}, ${oauthApplication}, ${mealPlans}, ${recipes}, ${shoppingLists}, ${user} RESTART IDENTITY CASCADE`
  );
}

// Fixture ids captured during setup
let ownerListId: number;
let otherListId: number;
let ownerRecipeId: number;
let otherRecipeId: number;

beforeAll(async () => {
  await cleanup();

  await db.insert(user).values([
    { id: OWNER, name: 'MCP Owner', email: `${OWNER}@test.local` },
    { id: OTHER, name: 'MCP Other', email: `${OTHER}@test.local` },
  ]);

  const insertedLists = await db
    .insert(shoppingLists)
    .values([
      { name: `${RUN} owner groceries`, createdBy: OWNER, updatedBy: OWNER },
      { name: `${RUN} other list`, createdBy: OTHER, updatedBy: OTHER },
    ])
    .returning();
  ownerListId = insertedLists[0].id;
  otherListId = insertedLists[1].id;

  const insertedRecipes = await db
    .insert(recipes)
    .values([
      {
        name: `${RUN} lentil curry`,
        description: 'A test curry',
        instructions: JSON.stringify(['Chop onions', 'Simmer lentils']),
        cuisine: 'indian',
        servings: 4,
        createdBy: OWNER,
        updatedBy: OWNER,
      },
      {
        name: `${RUN} secret cake`,
        instructions: 'Bake it',
        createdBy: OTHER,
        updatedBy: OTHER,
      },
    ])
    .returning();
  ownerRecipeId = insertedRecipes[0].id;
  otherRecipeId = insertedRecipes[1].id;

  await db.insert(recipeIngredients).values([
    { recipeId: ownerRecipeId, name: 'red lentils', quantity: '200', unit: 'g', position: 0 },
    { recipeId: ownerRecipeId, name: 'onion', quantity: '1', position: 1 },
  ]);

  await db.insert(oauthApplication).values({
    id: `${RUN}_app`,
    name: 'test mcp client',
    clientId: CLIENT_ID,
    redirectUrls: 'https://example.com/callback',
    type: 'public',
  });

  await db.insert(oauthAccessToken).values([
    {
      id: `${RUN}_at_valid`,
      accessToken: VALID_TOKEN,
      refreshToken: `${RUN}_rt_valid`,
      accessTokenExpiresAt: new Date(Date.now() + HOUR),
      refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * HOUR),
      clientId: CLIENT_ID,
      userId: OWNER,
      scopes: 'openid profile email offline_access',
    },
    {
      id: `${RUN}_at_expired`,
      accessToken: EXPIRED_TOKEN,
      refreshToken: `${RUN}_rt_expired`,
      accessTokenExpiresAt: new Date(Date.now() - HOUR),
      refreshTokenExpiresAt: new Date(Date.now() - HOUR),
      clientId: CLIENT_ID,
      userId: OWNER,
      scopes: 'openid',
    },
  ]);
});

afterAll(async () => {
  await cleanup();
});

describe('MCP endpoint auth', () => {
  it('rejects requests without a bearer token with a 401 challenge', async () => {
    const res = await mcpRequest(toolCallBody(1));
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain(
      'resource_metadata='
    );
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain('Unauthorized');
  });

  it('rejects an unknown bearer token', async () => {
    const res = await mcpRequest(toolCallBody(2), `${RUN}_nonexistent`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired bearer token (expiry enforced in our route)', async () => {
    const res = await mcpRequest(toolCallBody(3), EXPIRED_TOKEN);
    expect(res.status).toBe(401);
  });
});

describe('list_shopping_lists tool', () => {
  it('is advertised via tools/list', async () => {
    const res = await mcpRequest(
      { jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} },
      VALID_TOKEN
    );
    expect(res.status).toBe(200);
    const rpc = await readJsonRpc(res);
    const names = rpc.result.tools.map((t: any) => t.name);
    expect(names).toContain('list_shopping_lists');
  });

  it("returns only the token owner's lists", async () => {
    const res = await mcpRequest(toolCallBody(5), VALID_TOKEN);
    expect(res.status).toBe(200);
    const rpc = await readJsonRpc(res);
    expect(rpc.error).toBeUndefined();
    const payload = JSON.parse(rpc.result.content[0].text);
    expect(payload.total).toBe(1);
    expect(payload.lists[0].name).toBe(`${RUN} owner groceries`);
    // Trimmed shape: no ownership/household internals in the tool output.
    expect(payload.lists[0]).not.toHaveProperty('createdBy');
  });
});

describe('shopping list item tools', () => {
  it('add_shopping_list_items inserts, then merges duplicates', async () => {
    const first = parsePayload(
      await callTool('add_shopping_list_items', {
        listId: ownerListId,
        items: [
          { name: 'milk', quantity: 1, unit: 'l' },
          { name: 'bread' },
        ],
      })
    );
    expect(first.added).toHaveLength(2);
    expect(first.added.every((a: any) => a.merged === false)).toBe(true);

    // Same name+unit again -> merged, quantity summed
    const second = parsePayload(
      await callTool('add_shopping_list_items', {
        listId: ownerListId,
        items: [{ name: 'milk', quantity: 2, unit: 'l' }],
      })
    );
    expect(second.added[0].merged).toBe(true);
    expect(second.added[0].quantity).toBe(3);
  });

  it("add_shopping_list_items refuses another user's list", async () => {
    const result = await callTool('add_shopping_list_items', {
      listId: otherListId,
      items: [{ name: 'sneaky item' }],
    });
    expect(result.isError).toBe(true);
  });

  it('get_shopping_list returns the items with ids', async () => {
    const payload = parsePayload(
      await callTool('get_shopping_list', { listId: ownerListId })
    );
    expect(payload.list.name).toBe(`${RUN} owner groceries`);
    const names = payload.items.map((i: any) => i.name);
    expect(names).toContain('milk');
    expect(names).toContain('bread');
    expect(payload.items[0].id).toBeTypeOf('number');
  });

  it("get_shopping_list refuses another user's list", async () => {
    const result = await callTool('get_shopping_list', { listId: otherListId });
    expect(result.isError).toBe(true);
  });

  it('update_shopping_list_item checks an item off', async () => {
    const list = parsePayload(
      await callTool('get_shopping_list', { listId: ownerListId })
    );
    const bread = list.items.find((i: any) => i.name === 'bread');

    const updated = parsePayload(
      await callTool('update_shopping_list_item', {
        listId: ownerListId,
        itemId: bread.id,
        checked: true,
      })
    );
    expect(updated.checked).toBe(true);

    const [row] = await db
      .select()
      .from(shoppingListItems)
      .where(eq(shoppingListItems.id, bread.id));
    expect(row.checked).toBe(true);
    expect(row.checkedBy).toBe(OWNER);
  });

  it('remove_shopping_list_item deletes the row', async () => {
    const added = parsePayload(
      await callTool('add_shopping_list_items', {
        listId: ownerListId,
        items: [{ name: 'temporary item' }],
      })
    );
    const itemId = added.added[0].id;

    const removed = parsePayload(
      await callTool('remove_shopping_list_item', {
        listId: ownerListId,
        itemId,
      })
    );
    expect(removed.removed.name).toBe('temporary item');

    const rows = await db
      .select()
      .from(shoppingListItems)
      .where(eq(shoppingListItems.id, itemId));
    expect(rows).toHaveLength(0);
  });
});

describe('recipe tools', () => {
  it('search_recipes finds own recipes by ingredient text, never others', async () => {
    const payload = parsePayload(
      await callTool('search_recipes', { search: 'lentil' })
    );
    expect(payload.total).toBe(1);
    expect(payload.recipes[0].name).toBe(`${RUN} lentil curry`);

    const all = parsePayload(await callTool('search_recipes', {}));
    const names = all.recipes.map((r: any) => r.name);
    expect(names).not.toContain(`${RUN} secret cake`);
  });

  it('get_recipe returns full detail with parsed instructions', async () => {
    const payload = parsePayload(
      await callTool('get_recipe', { recipeId: ownerRecipeId })
    );
    expect(payload.name).toBe(`${RUN} lentil curry`);
    expect(payload.instructions).toEqual(['Chop onions', 'Simmer lentils']);
    expect(payload.ingredients).toHaveLength(2);
    expect(payload.ingredients[0].quantity).toBe(200);
  });

  it("get_recipe refuses another user's recipe", async () => {
    const result = await callTool('get_recipe', { recipeId: otherRecipeId });
    expect(result.isError).toBe(true);
  });

  it('create_recipe persists recipe, ingredients, and categories', async () => {
    const created = parsePayload(
      await callTool('create_recipe', {
        name: `${RUN} pancakes`,
        instructions: ['Mix', 'Fry'],
        servings: 2,
        ingredients: [
          { name: 'flour', quantity: 150, unit: 'g' },
          { name: 'egg', quantity: 2 },
        ],
        categories: [{ type: 'meal_type', value: 'breakfast' }],
      })
    );
    expect(created.id).toBeTypeOf('number');

    const detail = parsePayload(
      await callTool('get_recipe', { recipeId: created.id })
    );
    expect(detail.instructions).toEqual(['Mix', 'Fry']);
    expect(detail.ingredients.map((i: any) => i.name)).toEqual(['flour', 'egg']);
    expect(detail.categories).toEqual([
      { type: 'meal_type', value: 'breakfast' },
    ]);
  });

  it('update_recipe changes only provided fields, keeping ingredients', async () => {
    const updated = parsePayload(
      await callTool('update_recipe', {
        recipeId: ownerRecipeId,
        rating: 5,
      })
    );
    expect(updated.id).toBe(ownerRecipeId);

    const detail = parsePayload(
      await callTool('get_recipe', { recipeId: ownerRecipeId })
    );
    expect(detail.rating).toBe(5);
    expect(detail.name).toBe(`${RUN} lentil curry`);
    // Ingredients untouched because they were not provided
    expect(detail.ingredients).toHaveLength(2);
  });
});

describe('meal plan tools', () => {
  const WEEK = '2026-03-02'; // a Monday
  let mealPlanId: number;
  let entryId: number;

  it('are advertised via tools/list', async () => {
    const res = await mcpRequest(
      { jsonrpc: '2.0', id: ++rpcId, method: 'tools/list', params: {} },
      VALID_TOKEN
    );
    const rpc = await readJsonRpc(res);
    const names = rpc.result.tools.map((t: any) => t.name);
    for (const name of [
      'get_meal_plan',
      'add_meal_plan_entry',
      'update_meal_plan_entry',
      'remove_meal_plan_entry',
      'meal_plan_to_shopping_list',
    ]) {
      expect(names).toContain(name);
    }
  });

  it('add_meal_plan_entry creates the plan on first use, reuses it after', async () => {
    const first = parsePayload(
      await callTool('add_meal_plan_entry', {
        week: WEEK,
        dayOfWeek: 0,
        mealType: 'dinner',
        recipeId: ownerRecipeId,
      })
    );
    expect(first.planCreated).toBe(true);
    expect(first.entry.recipeName).toBe(`${RUN} lentil curry`);
    mealPlanId = first.mealPlanId;
    entryId = first.entry.id;

    const second = parsePayload(
      await callTool('add_meal_plan_entry', {
        week: WEEK,
        dayOfWeek: 2,
        mealType: 'dinner',
        customText: 'Leftovers',
      })
    );
    expect(second.planCreated).toBe(false);
    expect(second.mealPlanId).toBe(mealPlanId);
  });

  it("add_meal_plan_entry refuses another user's recipe", async () => {
    const result = await callTool('add_meal_plan_entry', {
      week: WEEK,
      dayOfWeek: 1,
      mealType: 'dinner',
      recipeId: otherRecipeId,
    });
    expect(result.isError).toBe(true);
  });

  it('add_meal_plan_entry requires a recipe or custom text', async () => {
    const result = await callTool('add_meal_plan_entry', {
      week: WEEK,
      dayOfWeek: 1,
      mealType: 'lunch',
    });
    expect(result.isError).toBe(true);
  });

  it('get_meal_plan returns the entries, and null for unplanned weeks', async () => {
    const payload = parsePayload(await callTool('get_meal_plan', { week: WEEK }));
    expect(payload.plan.id).toBe(mealPlanId);
    expect(payload.plan.entries).toHaveLength(2);
    const dinner = payload.plan.entries.find((e: any) => e.id === entryId);
    expect(dinner.recipeName).toBe(`${RUN} lentil curry`);
    expect(dinner.dayOfWeek).toBe(0);

    const empty = parsePayload(
      await callTool('get_meal_plan', { week: '2026-06-01' })
    );
    expect(empty.plan).toBeNull();
  });

  it("get_meal_plan cannot see another user's plan", async () => {
    await db.insert(mealPlans).values({
      weekStartDate: '2026-03-09',
      createdBy: OTHER,
      updatedBy: OTHER,
    });
    const payload = parsePayload(
      await callTool('get_meal_plan', { week: '2026-03-09' })
    );
    expect(payload.plan).toBeNull();
  });

  it('update_meal_plan_entry moves a meal to another day', async () => {
    const payload = parsePayload(
      await callTool('update_meal_plan_entry', {
        mealPlanId,
        entryId,
        dayOfWeek: 4,
      })
    );
    expect(payload.entry.dayOfWeek).toBe(4);
    // Recipe link untouched because it was not provided
    expect(payload.entry.recipeName).toBe(`${RUN} lentil curry`);
  });

  it("meal_plan_to_shopping_list creates a list with the plan's ingredients", async () => {
    const payload = parsePayload(
      await callTool('meal_plan_to_shopping_list', {
        mealPlanId,
        newListName: `${RUN} week shop`,
      })
    );
    expect(payload.list.name).toBe(`${RUN} week shop`);
    // The one linked recipe has two ingredients: red lentils + onion
    expect(payload.totalIngredients).toBe(2);
    expect(payload.addedCount).toBe(2);
    expect(payload.mergedCount).toBe(0);
  });

  it('remove_meal_plan_entry deletes the entry', async () => {
    const payload = parsePayload(
      await callTool('remove_meal_plan_entry', { mealPlanId, entryId })
    );
    expect(payload.removed.id).toBe(entryId);

    const remaining = parsePayload(
      await callTool('get_meal_plan', { week: WEEK })
    );
    expect(remaining.plan.entries).toHaveLength(1);
    expect(remaining.plan.entries[0].customText).toBe('Leftovers');
  });
});

describe('nutrition tools', () => {
  it('get_nutrition_targets returns derived targets, never raw measurements', async () => {
    await db.insert(nutritionProfiles).values({
      userId: OWNER,
      heightCm: 180,
      weightKg: '80',
      dateOfBirth: '1990-07-01',
      sex: 'male',
      activityLevel: 'moderate',
      goal: 'maintain',
    });

    const payload = parsePayload(await callTool('get_nutrition_targets', {}));
    expect(payload.members).toHaveLength(1);

    const [member] = payload.members;
    expect(member.name).toBe('MCP Owner');
    expect(member.isSelf).toBe(true);
    expect(member.targets.caloriesKcal).toBeGreaterThan(2000);
    expect(member.targets.proteinG).toBe(128); // 1.6 g/kg * 80

    // Privacy: raw profile fields must never appear in the tool output
    const raw = JSON.stringify(payload);
    expect(raw).not.toContain('heightCm');
    expect(raw).not.toContain('weightKg');
    expect(raw).not.toContain('dateOfBirth');
    expect(raw).not.toContain('1990');
  });

  it('get_meal_plan entries include per-serving nutrition once enriched', async () => {
    await db.insert(recipeNutrition).values({
      recipeId: ownerRecipeId,
      status: 'ready',
      caloriesKcal: '205.0',
      proteinG: '13.4',
      carbsG: '36.8',
      fatG: '0.8',
      estimated: true,
      matchedCount: 2,
      totalCount: 2,
    });

    const added = parsePayload(
      await callTool('add_meal_plan_entry', {
        week: '2026-03-02',
        dayOfWeek: 5,
        mealType: 'dinner',
        recipeId: ownerRecipeId,
      })
    );

    const payload = parsePayload(
      await callTool('get_meal_plan', { week: '2026-03-02' })
    );
    const entry = payload.plan.entries.find((e: any) => e.id === added.entry.id);
    expect(entry.nutrition).toEqual({
      caloriesKcal: 205,
      proteinG: 13.4,
      carbsG: 36.8,
      fatG: 0.8,
      estimated: true,
    });

    // Custom-text entries carry no nutrition
    const leftovers = payload.plan.entries.find(
      (e: any) => e.customText === 'Leftovers'
    );
    expect(leftovers.nutrition).toBeNull();
  });
});
