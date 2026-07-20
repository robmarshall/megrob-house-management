import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  user,
  shoppingLists,
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

async function cleanup() {
  await db.execute(
    sql`TRUNCATE TABLE ${oauthAccessToken}, ${oauthApplication}, ${shoppingLists}, ${user} RESTART IDENTITY CASCADE`
  );
}

beforeAll(async () => {
  await cleanup();

  await db.insert(user).values([
    { id: OWNER, name: 'MCP Owner', email: `${OWNER}@test.local` },
    { id: OTHER, name: 'MCP Other', email: `${OTHER}@test.local` },
  ]);

  await db.insert(shoppingLists).values([
    { name: `${RUN} owner groceries`, createdBy: OWNER, updatedBy: OWNER },
    { name: `${RUN} other list`, createdBy: OTHER, updatedBy: OTHER },
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
    const body = await res.json();
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
