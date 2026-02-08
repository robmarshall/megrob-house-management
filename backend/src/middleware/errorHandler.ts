import type { Context } from 'hono';
import { logger } from '../lib/logger.js';

export function onError(err: Error, c: Context) {
  const requestId = c.get('requestId') as string | undefined;

  logger.error(
    {
      requestId,
      err,
      method: c.req.method,
      path: c.req.path,
    },
    `Unhandled error: ${err.message}`
  );

  return c.json({ error: 'Internal server error' }, 500);
}
