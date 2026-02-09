import type { Context, Next } from 'hono';
import type { z } from 'zod';

/**
 * Validation middleware factory for Hono routes
 * Validates request body against a Zod schema
 */
export function validateBody<T extends z.ZodType>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const result = schema.safeParse(body);

      if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        return c.json(
          {
            error: 'Validation failed',
            details: errors,
          },
          400
        );
      }

      // Store validated data in context for use in handler
      c.set('validatedBody', result.data);
      await next();
    } catch (error) {
      // Handle JSON parse errors
      if (error instanceof SyntaxError) {
        return c.json({ error: 'Invalid JSON body' }, 400);
      }
      throw error;
    }
  };
}

/**
 * Validation middleware factory for query parameters
 * Validates query params against a Zod schema
 */
export function validateQuery<T extends z.ZodType>(schema: T) {
  return async (c: Context, next: Next) => {
    const query = c.req.query();
    const result = schema.safeParse(query);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      return c.json(
        {
          error: 'Invalid query parameters',
          details: errors,
        },
        400
      );
    }

    c.set('validatedQuery', result.data);
    await next();
  };
}

/**
 * Helper to get validated body from context
 */
export function getValidatedBody<T>(c: Context): T {
  return c.get('validatedBody') as T;
}

/**
 * Helper to get validated query from context
 */
export function getValidatedQuery<T>(c: Context): T {
  return c.get('validatedQuery') as T;
}
