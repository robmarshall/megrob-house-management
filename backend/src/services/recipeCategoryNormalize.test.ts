import { describe, it, expect } from 'vitest';
import { normalizeCategoryInputs } from './recipeRelations.js';

describe('normalizeCategoryInputs', () => {
  it('moves meal types outside the fixed list to tags', () => {
    expect(
      normalizeCategoryInputs([
        { type: 'meal_type', value: 'dinner' },
        { type: 'meal_type', value: 'Camping' },
      ])
    ).toEqual([
      { type: 'meal_type', value: 'dinner' },
      { type: 'tag', value: 'Camping' },
    ]);
  });

  it('keeps a known meal type regardless of case', () => {
    expect(normalizeCategoryInputs([{ type: 'meal_type', value: 'Main' }])).toEqual([
      { type: 'meal_type', value: 'Main' },
    ]);
  });

  it('collapses tag whitespace and strips commas', () => {
    expect(
      normalizeCategoryInputs([{ type: 'tag', value: '  Batch,  cook ' }])
    ).toEqual([{ type: 'tag', value: 'Batch cook' }]);
  });

  it('drops duplicate tags case-insensitively, keeping the first spelling', () => {
    expect(
      normalizeCategoryInputs([
        { type: 'tag', value: 'Camping' },
        { type: 'tag', value: 'camping' },
        { type: 'meal_type', value: 'CAMPING' },
      ])
    ).toEqual([{ type: 'tag', value: 'Camping' }]);
  });

  it('drops exact duplicates of other types and empty tags', () => {
    expect(
      normalizeCategoryInputs([
        { type: 'dietary', value: 'vegan' },
        { type: 'dietary', value: 'vegan' },
        { type: 'tag', value: ' , ' },
      ])
    ).toEqual([{ type: 'dietary', value: 'vegan' }]);
  });
});
