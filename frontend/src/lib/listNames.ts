/**
 * Picks a name for a new list that does not clash with any existing name.
 *
 * Returns `base` when it is free, otherwise the first of "base 2", "base 3", …
 * that is not taken. Comparison is case-insensitive and ignores surrounding
 * whitespace, so "shopping " counts as taking "Shopping".
 */
export function uniqueListName(base: string, existingNames: Iterable<string>): string {
  const taken = new Set<string>();
  for (const name of existingNames) {
    taken.add(name.trim().toLowerCase());
  }

  if (!taken.has(base.trim().toLowerCase())) {
    return base;
  }

  let suffix = 2;
  while (taken.has(`${base} ${suffix}`.trim().toLowerCase())) {
    suffix += 1;
  }
  return `${base} ${suffix}`;
}
