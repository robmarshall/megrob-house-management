import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Architectural guard: **nothing the frontend can reach may contact Snozone.**
 *
 * The collector is the sole upstream caller, at a fixed 7 requests per 30
 * minutes however much anyone browses. That is what keeps the request rate
 * defensible (brief.md §7) and what makes the UI fast and independent of
 * Snozone being up. Phase 0's viewer proxied upstream on every page load; the
 * whole point of the collector is that this no longer happens.
 *
 * That property is easy to lose by accident — one convenient `fetch` in a
 * service, or an import of the client "just to refresh" — and the loss would be
 * silent, showing up only as an unexplained rise in upstream traffic. So it is
 * asserted here rather than left to code review.
 *
 * These tests read source text deliberately. A behavioural test cannot prove
 * the *absence* of a network call on paths it does not happen to exercise.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Everything reachable from an HTTP request the frontend can make. */
const REQUEST_PATH_FILES = [
  'routes/snozone.ts',
  'services/snozoneAvailabilityService.ts',
  'services/snozoneRecommendService.ts',
  'services/snozoneStatusService.ts',
  'services/snozoneAnalyticsService.ts',
];

/** The only module allowed to talk to Snozone, and its only legitimate callers. */
const UPSTREAM_CLIENT = 'snozoneClient';
const ALLOWED_UPSTREAM_CALLERS = ['services/snozoneCollector.ts'];

function read(relative: string): string {
  return readFileSync(join(SRC, relative), 'utf8');
}

/**
 * Source with comments removed.
 *
 * The forbidden-call check has to look at code, not prose: `snozoneClient.ts`
 * deliberately DOCUMENTS that setTime and delTime are absent, and a naive
 * substring search would flag the very comment explaining the guarantee.
 */
function code(relative: string): string {
  return read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('Snozone request paths never contact Snozone', () => {
  it.each(REQUEST_PATH_FILES)('%s does not import the Snozone client', (file) => {
    const src = read(file);
    // Type-only imports are fine: RecommendSlotInput is a shape, not a socket.
    const valueImport = new RegExp(
      `import\\s+(?!type\\b)[^;]*${UPSTREAM_CLIENT}`,
      's'
    );
    expect(valueImport.test(src), `${file} imports ${UPSTREAM_CLIENT}`).toBe(false);
  });

  it.each(REQUEST_PATH_FILES)('%s contains no outbound HTTP call', (file) => {
    const src = read(file);
    expect(/\bfetch\s*\(/.test(src), `${file} calls fetch()`).toBe(false);
    expect(/https?:\/\/(?!localhost)/.test(src.replace(/^\s*\*.*$/gm, '')),
      `${file} references an external URL`).toBe(false);
  });

  it.each(REQUEST_PATH_FILES)('%s never mentions the Snozone host', (file) => {
    expect(read(file)).not.toMatch(/snozoneuk\.com/i);
  });

  it('keeps the collector as the only module that may call upstream', () => {
    // If this fails, a second upstream caller has appeared. That is not
    // automatically wrong, but it doubles the request rate and must be a
    // deliberate decision, not a side effect.
    for (const file of ALLOWED_UPSTREAM_CALLERS) {
      expect(read(file)).toMatch(new RegExp(UPSTREAM_CLIENT));
    }
    const client = read('lib/snozoneClient.ts');
    expect(client).toMatch(/snozoneuk\.com/);
  });

  it('still refuses to implement any booking or basket call', () => {
    // brief.md §10.3: setTime holds a slot and puts it in a basket, delTime
    // releases one. Neither is implemented anywhere, and neither should appear
    // without a deliberate decision — this project is read-only by construction.
    for (const file of [...REQUEST_PATH_FILES, 'lib/snozoneClient.ts', 'services/snozoneCollector.ts']) {
      const src = code(file);
      for (const forbidden of ['setTime', 'delTime', 'delBundleTimes', 'delBasketKeys']) {
        // Word-bounded: `setTimeout` contains 'setTime' but is not the booking
        // call. A real one would appear as `setTime=1` in a query string, which
        // this still catches.
        const call = new RegExp(`\b${forbidden}\b`);
        expect(call.test(src), `${file} references ${forbidden}`).toBe(false);
      }
    }
  });
});
