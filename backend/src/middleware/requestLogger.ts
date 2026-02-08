import type { Context, Next } from 'hono';
import { logger } from '../lib/logger.js';

let counter = 0;

function generateRequestId(): string {
  counter = (counter + 1) % 1_000_000;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

export async function requestLogger(c: Context, next: Next) {
  const requestId = generateRequestId();
  c.set('requestId', requestId);
  c.header('X-Request-Id', requestId);

  const start = performance.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = Math.round(performance.now() - start);
  const status = c.res.status;
  const userId = c.get('userId') as string | undefined;

  const logData = {
    requestId,
    method,
    path,
    status,
    duration,
    ...(userId && { userId }),
  };

  if (status >= 500) {
    logger.error(logData, `${method} ${path} ${status} ${duration}ms`);
  } else if (status >= 400) {
    logger.warn(logData, `${method} ${path} ${status} ${duration}ms`);
  } else {
    logger.info(logData, `${method} ${path} ${status} ${duration}ms`);
  }
}
