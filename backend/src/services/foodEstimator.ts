/**
 * LLM food estimator — the last-resort tier of nutrition enrichment.
 *
 * Uses DeepSeek (deepseek-chat via the OpenAI-compatible API) to normalize an
 * ingredient into a typical gram weight for one unit plus per-100g nutrition.
 * Chosen over Claude for cost; the calls are tiny structured-extraction tasks
 * and every result is cached forever in ingredient_food_cache, so each
 * distinct ingredient string is paid for at most once.
 *
 * When DEEPSEEK_API_KEY is unset the estimator reports unconfigured and the
 * enrichment pipeline simply counts those ingredients as unmatched.
 */

import { z } from 'zod';
import { logger } from '../lib/logger.js';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';
const REQUEST_TIMEOUT_MS = 30_000;

export interface FoodEstimate {
  /** Typical grams for ONE of the given unit of this ingredient */
  gramsPerUnit: number;
  /** Nutrition per 100 g of the food */
  per100g: {
    caloriesKcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number | null;
    sugarG: number | null;
    saltG: number | null;
  };
}

const estimateSchema = z.object({
  gramsPerUnit: z.number().positive(),
  per100g: z.object({
    caloriesKcal: z.number().min(0).max(900),
    proteinG: z.number().min(0).max(100),
    carbsG: z.number().min(0).max(100),
    fatG: z.number().min(0).max(100),
    fiberG: z.number().min(0).max(100).nullable(),
    sugarG: z.number().min(0).max(100).nullable(),
    saltG: z.number().min(0).max(100).nullable(),
  }),
});

export function isFoodEstimatorConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

function buildPrompt(name: string, unit: string): string {
  const unitPhrase =
    unit === 'item' ? `one typical whole item of` : `one ${unit} of`;
  return (
    `Ingredient: "${name}"\n` +
    `Estimate (1) the weight in grams of ${unitPhrase} this ingredient as ` +
    `used in home cooking, and (2) its nutrition per 100 grams (edible ` +
    `portion, as purchased).\n` +
    `Respond with ONLY a JSON object in exactly this shape:\n` +
    `{"gramsPerUnit": number, "per100g": {"caloriesKcal": number, ` +
    `"proteinG": number, "carbsG": number, "fatG": number, ` +
    `"fiberG": number|null, "sugarG": number|null, "saltG": number|null}}\n` +
    `Use null only when a per-100g value is genuinely unknown. ` +
    `saltG is salt (not sodium) in grams.`
  );
}

async function callDeepSeek(prompt: string): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a food nutrition estimator. You respond with strict JSON only.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 300,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      logger.warn(
        { status: res.status, body: (await res.text()).slice(0, 200) },
        'DeepSeek request failed'
      );
      return null;
    }

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return payload.choices?.[0]?.message?.content ?? null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Estimate gram weight + per-100g nutrition for an ingredient. `unit` must be
 * a canonical unit ('g', 'cups', 'tbsp', 'item', ...). Returns null when the
 * estimator is unconfigured, the request fails, or the response doesn't
 * validate after one retry.
 */
export async function estimateFood(
  name: string,
  unit: string
): Promise<FoodEstimate | null> {
  if (!isFoodEstimatorConfigured()) return null;

  const prompt = buildPrompt(name, unit);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const content = await callDeepSeek(prompt);
      if (!content) continue;

      const parsed = estimateSchema.safeParse(JSON.parse(content));
      if (parsed.success) return parsed.data;

      logger.warn(
        { name, unit, attempt, issues: parsed.error.issues.slice(0, 3) },
        'DeepSeek estimate failed validation'
      );
    } catch (err) {
      logger.warn({ err, name, unit, attempt }, 'DeepSeek estimate errored');
    }
  }

  return null;
}
