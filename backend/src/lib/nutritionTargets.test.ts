import { describe, it, expect } from 'vitest';
import {
  calculateAge,
  mifflinStJeorBmr,
  computeNutritionTargets,
  FIBER_G,
  SALT_G,
} from './nutritionTargets.js';

// Fixed "today" so age-dependent results never drift
const TODAY = new Date('2026-07-21T12:00:00');

const FULL_PROFILE = {
  heightCm: 180,
  weightKg: 80,
  dateOfBirth: '1990-07-01', // 36 on TODAY
  sex: 'male' as const,
  activityLevel: 'moderate' as const,
  goal: 'maintain' as const,
};

describe('calculateAge', () => {
  it('computes whole years', () => {
    expect(calculateAge('1990-07-01', TODAY)).toBe(36);
  });

  it('does not count a birthday that has not happened yet this year', () => {
    expect(calculateAge('1990-07-22', TODAY)).toBe(35);
  });

  it('counts a birthday falling on today', () => {
    expect(calculateAge('1990-07-21', TODAY)).toBe(36);
  });
});

describe('mifflinStJeorBmr', () => {
  it('matches the published formula for males', () => {
    // 10*80 + 6.25*180 - 5*36 + 5 = 800 + 1125 - 180 + 5
    expect(mifflinStJeorBmr(80, 180, 36, 'male')).toBe(1750);
  });

  it('matches the published formula for females', () => {
    // 10*65 + 6.25*165 - 5*30 - 161 = 650 + 1031.25 - 150 - 161
    expect(mifflinStJeorBmr(65, 165, 30, 'female')).toBe(1370.25);
  });
});

describe('computeNutritionTargets', () => {
  it('computes a full set of targets from a complete profile', () => {
    const t = computeNutritionTargets(FULL_PROFILE, TODAY);

    // BMR 1750 * 1.55 (moderate) = 2712.5 -> maintain -> 2713 (rounded)
    expect(t.caloriesKcal).toBe(2713);
    // 1.6 g/kg * 80
    expect(t.proteinG).toBe(128);
    // 30% of calories / 9
    expect(t.fatG).toBe(Math.round((2713 * 0.3) / 9));
    // remainder / 4
    expect(t.carbsG).toBe(
      Math.round((2713 - 128 * 4 - t.fatG! * 9) / 4)
    );
    expect(t.fiberG).toBe(FIBER_G);
    expect(t.saltG).toBe(SALT_G);
    expect(t.complete).toBe(true);
    expect(t.overridden).toEqual({
      calories: false,
      protein: false,
      carbs: false,
      fat: false,
    });
  });

  it('applies the goal factor', () => {
    const maintain = computeNutritionTargets(FULL_PROFILE, TODAY);
    const lose = computeNutritionTargets({ ...FULL_PROFILE, goal: 'lose' }, TODAY);
    const gain = computeNutritionTargets({ ...FULL_PROFILE, goal: 'gain' }, TODAY);

    expect(lose.caloriesKcal).toBe(Math.round(2712.5 * 0.85));
    expect(gain.caloriesKcal).toBe(Math.round(2712.5 * 1.15));
    expect(lose.caloriesKcal!).toBeLessThan(maintain.caloriesKcal!);
    expect(gain.caloriesKcal!).toBeGreaterThan(maintain.caloriesKcal!);
  });

  it('uses the female constant', () => {
    const t = computeNutritionTargets(
      {
        heightCm: 165,
        weightKg: 65,
        dateOfBirth: '1996-01-15', // 30 on TODAY
        sex: 'female',
        activityLevel: 'light',
        goal: 'maintain',
      },
      TODAY
    );
    // BMR 1370.25 * 1.375 = 1884.09...
    expect(t.caloriesKcal).toBe(Math.round(1370.25 * 1.375));
  });

  it('returns null calories (but still protein) when the profile is partial', () => {
    const t = computeNutritionTargets({ weightKg: 70 }, TODAY);
    expect(t.complete).toBe(false);
    expect(t.caloriesKcal).toBeNull();
    expect(t.fatG).toBeNull();
    expect(t.carbsG).toBeNull();
    // Protein only needs weight
    expect(t.proteinG).toBe(112);
  });

  it('returns all-null macros for an empty profile', () => {
    const t = computeNutritionTargets({}, TODAY);
    expect(t.caloriesKcal).toBeNull();
    expect(t.proteinG).toBeNull();
    expect(t.carbsG).toBeNull();
    expect(t.fatG).toBeNull();
    // Static reference values still present
    expect(t.fiberG).toBe(FIBER_G);
    expect(t.saltG).toBe(SALT_G);
  });

  it('override replaces a single macro and flags it', () => {
    const t = computeNutritionTargets(
      { ...FULL_PROFILE, overrideProteinG: 150 },
      TODAY
    );
    expect(t.proteinG).toBe(150);
    expect(t.overridden.protein).toBe(true);
    expect(t.overridden.calories).toBe(false);
    // Carbs derive from the OVERRIDDEN protein value
    expect(t.carbsG).toBe(
      Math.round((t.caloriesKcal! - 150 * 4 - t.fatG! * 9) / 4)
    );
  });

  it('calorie override flows through to fat and carbs', () => {
    const t = computeNutritionTargets(
      { ...FULL_PROFILE, overrideCaloriesKcal: 2000 },
      TODAY
    );
    expect(t.caloriesKcal).toBe(2000);
    expect(t.fatG).toBe(Math.round((2000 * 0.3) / 9));
    expect(t.carbsG).toBe(
      Math.round((2000 - t.proteinG! * 4 - t.fatG! * 9) / 4)
    );
  });

  it('overrides work without any formula inputs (manual-only profiles)', () => {
    const t = computeNutritionTargets(
      {
        overrideCaloriesKcal: 1800,
        overrideProteinG: 90,
        overrideCarbsG: 200,
        overrideFatG: 60,
      },
      TODAY
    );
    expect(t.caloriesKcal).toBe(1800);
    expect(t.proteinG).toBe(90);
    expect(t.carbsG).toBe(200);
    expect(t.fatG).toBe(60);
    expect(t.complete).toBe(false);
  });

  it('carbs never go negative', () => {
    const t = computeNutritionTargets(
      { ...FULL_PROFILE, overrideCaloriesKcal: 500, overrideProteinG: 200 },
      TODAY
    );
    expect(t.carbsG).toBe(0);
  });
});
