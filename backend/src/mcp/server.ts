import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listShoppingLists } from '../services/shoppingListService.js';
import { logger } from '../lib/logger.js';

/**
 * Build an MCP server scoped to one authenticated user. A fresh instance is
 * created per request (stateless Streamable HTTP), so the userId captured here
 * can never leak across users.
 *
 * Tool responses are deliberately trimmed: list tools return summary shapes
 * only, so large households don't flood the model's context.
 */
export function createMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: 'megrob-house-management',
    version: '1.0.0',
  });

  server.registerTool(
    'list_shopping_lists',
    {
      title: 'List shopping lists',
      description:
        "List the user's shopping lists (household-shared and personal). " +
        'Returns list ids, names, descriptions, and last-updated timestamps. ' +
        'Use the returned id with other shopping-list tools.',
      inputSchema: {
        page: z.number().int().min(1).optional().describe('Page number (default 1)'),
        pageSize: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('Results per page (default 20, max 100)'),
      },
    },
    async ({ page, pageSize }) => {
      logger.info(
        { via: 'mcp', userId, tool: 'list_shopping_lists' },
        'MCP tool call'
      );
      const result = await listShoppingLists(userId, { page, pageSize });
      const payload = {
        lists: result.data.map((list) => ({
          id: list.id,
          name: list.name,
          description: list.description,
          updatedAt: list.updatedAt,
        })),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload) }],
      };
    }
  );

  return server;
}
