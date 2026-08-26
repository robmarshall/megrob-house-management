import { logger } from './logger.js';

/**
 * Minimal Telegram Bot API client.
 *
 * Zero dependencies — the Bot API is plain HTTPS with JSON, and pulling in a
 * library for two endpoints would add a supply-chain surface for no benefit.
 *
 * Never logs the bot token. Telegram embeds it in the URL path, so the URL
 * itself is a secret and must not appear in logs or error messages; errors here
 * carry only the endpoint name and Telegram's own description.
 */

const API = 'https://api.telegram.org';
const TIMEOUT_MS = 10_000;

export class TelegramError extends Error {
  readonly endpoint: string;
  readonly status?: number;

  constructor(message: string, endpoint: string, status?: number) {
    super(message);
    this.name = 'TelegramError';
    this.endpoint = endpoint;
    this.status = status;
  }
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

async function call<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API}/bot${token}/${method}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const reason = err instanceof Error && err.name === 'AbortError'
      ? `timed out after ${TIMEOUT_MS}ms`
      : 'network error';
    throw new TelegramError(`${method} ${reason}`, method);
  } finally {
    clearTimeout(timer);
  }

  let payload: TelegramResponse<T>;
  try {
    payload = (await res.json()) as TelegramResponse<T>;
  } catch {
    throw new TelegramError(`${method} returned a non-JSON response`, method, res.status);
  }

  if (!payload.ok || payload.result === undefined) {
    // Telegram's description is the useful part ('chat not found', 'Unauthorized').
    throw new TelegramError(
      payload.description || `${method} failed`,
      method,
      payload.error_code ?? res.status
    );
  }
  return payload.result;
}

export interface TelegramBotInfo {
  id: number;
  username: string;
  first_name: string;
}

/** Verify a token and learn which bot it belongs to. */
export async function getBotInfo(token: string): Promise<TelegramBotInfo> {
  return call<TelegramBotInfo>(token, 'getMe');
}

/**
 * Send a message.
 *
 * Uses no parse_mode: alert text includes error strings from upstream, and
 * Markdown/HTML parsing would let a stray underscore or angle bracket cause a
 * 400 and lose the alert entirely. Plain text always delivers.
 */
export async function sendMessage(
  token: string,
  chatId: string,
  text: string
): Promise<void> {
  // Telegram rejects messages over 4096 characters.
  const body = text.length > 4000 ? `${text.slice(0, 3990)}\n…(truncated)` : text;
  await call<unknown>(token, 'sendMessage', {
    chat_id: chatId,
    text: body,
    disable_web_page_preview: true,
  });
  logger.debug({ chatId }, 'Telegram message sent');
}
