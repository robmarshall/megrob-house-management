import { describe, it, expect } from 'vitest';
import { collectionLabel } from './useData';

describe('collectionLabel', () => {
  it('converts a single-segment collection to a space-separated label', () => {
    expect(collectionLabel('shopping-lists')).toBe('shopping lists');
  });

  it('leaves a single-word collection unchanged', () => {
    expect(collectionLabel('recipes')).toBe('recipes');
  });

  it('uses the last segment for a nested collection with a numeric id', () => {
    expect(collectionLabel('shopping-lists/5/items')).toBe('items');
  });

  it('uses the last segment for a different nested collection', () => {
    expect(collectionLabel('recipes/12/feedback')).toBe('feedback');
  });

  it('handles a trailing slash gracefully', () => {
    expect(collectionLabel('shopping-lists/5/items/')).toBe('items');
  });

  it('falls back to the cleaned full collection when there is no usable segment', () => {
    expect(collectionLabel('')).toBe('');
    expect(collectionLabel('5')).toBe('5');
    expect(collectionLabel('5/')).toBe('5/');
  });
});
