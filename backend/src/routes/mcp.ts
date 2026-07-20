import { Hono, type Context } from 'hono';
import { StreamableHTTPTransport } from '@hono/mcp';
import { auth } from '../lib/auth.js';
import { createMcpServer } from '../mcp/server.js';

const app = new Hono();

/**
 * 401 challenge per the MCP auth spec: WWW-Authenticate points the client at
 * the protected-resource metadata so it can discover the OAuth server.
 * Mirrors better-auth's withMcpAuth response shape.
 */
function unauthorized(c: Context) {
  const challenge = `Bearer resource_metadata="${process.env.BETTER_AUTH_URL}/.well-known/oauth-protected-resource"`;
  c.header('WWW-Authenticate', challenge);
  c.header('Access-Control-Expose-Headers', 'WWW-Authenticate');
  return c.json(
    {
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Unauthorized: Authentication required' },
      id: null,
    },
    401
  );
}

/**
 * MCP endpoint (Streamable HTTP, stateless). Bearer tokens are issued by the
 * Better Auth mcp plugin's OAuth flow; getMcpSession resolves a token to its
 * oauth_access_token row.
 */
app.all('/', async (c) => {
  const token = await auth.api.getMcpSession({ headers: c.req.raw.headers });

  // better-auth 1.4.18's getMcpSession does NOT check token expiry, so
  // enforce accessTokenExpiresAt ourselves.
  if (
    !token ||
    !token.userId ||
    new Date(token.accessTokenExpiresAt) <= new Date()
  ) {
    return unauthorized(c);
  }

  const server = createMcpServer(token.userId);
  const transport = new StreamableHTTPTransport();
  await server.connect(transport);
  return transport.handleRequest(c);
});

export default app;
