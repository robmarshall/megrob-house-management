/**
 * Daily nutrition target calculation — pure functions, no DB access.
 *
 * Calories come from the Mifflin-St Jeor BMR equation scaled by an activity
 * multiplier (TDEE) and a goal adjustment. Protein is bodyweight-based;
 * fat is a fixed share of calories; carbs are the remainder. Every macro can
 * be manually overridden per-field on the profile, which also covers people
 * the formulas serve poorly (children, pregnancy, athletes with coaches).
 *
 * These are population-level estimates, not medical advice — the UI must say
 * so wherever targets are shown.
 */

export type Sex = 'male' | 'female';
export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';
export type Goal = 'lose' | 'maintain' | 'gain';

export interface NutritionProfileInput {
  heightCm?: number | null;
  weightKg?: number | null;
  /** YYYY-MM-DD */
  dateOfBirth?: string | null;
  sex?: Sex | null;
  activityLevel?: ActivityLevel | null;
  goal?: Goal | null;
  overrideCaloriesKcal?: number | null;
  overrideProteinG?: number | null;
  overrideCarbsG?: number | null;
  overrideFatG?: number | null;
}

export interface NutritionTargets {
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number;
  saltG: number;
  /** Per-macro flag: true when the value came from a manual override */
  overridden: {
    calories: boolean;
    protein: boolean;
    carbs: boolean;
    fat: boolean;
  };
  /** True when the profile had every input the calorie formula needs */
  complete: boolean;
}

/** TDEE multipliers for the five standard activity levels. */
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Calorie adjustment per goal (±15%). */
const GOAL_FACTORS: Record<Goal, number> = {
  lose: 0.85,
  maintain: 1,
  gain: 1.15,
};

/** Default protein target in grams per kg of bodyweight. */
export const PROTEIN_G_PER_KG = 1.6;

/** Share of daily calories allocated to fat. */
export const FAT_CALORIE_SHARE = 0.3;

/** Static daily reference values (UK guidance). */
export const FIBER_G = 30;
export const SALT_G = 6;

const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_CARBS = 4;
const KCAL_PER_G_FAT = 9;

/** Whole years between dateOfBirth (YYYY-MM-DD) and `today`. */
export function calculateAge(dateOfBirth: string, today: Date = new Date()): number {
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  let age = today.getFullYear() - dob.getFullYear();
  const hadBirthday =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

/**
 * Mifflin-St Jeor basal metabolic rate in kcal/day.
 */
export function mifflinStJeorBmr(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  sex: Sex
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === 'male' ? base + 5 : base - 161;
}

/**
 * Compute daily targets from a profile. Fields the inputs can't support come
 * back null (e.g. no weight -> no protein target) unless overridden. Carbs
 * are derived from whatever calories/protein/fat ended up final, so a manual
 * calorie override flows through to the carb remainder.
 */
export function computeNutritionTargets(
  profile: NutritionProfileInput,
  today: Date = new Date()
): NutritionTargets {
  const {
    heightCm,
    weightKg,
    dateOfBirth,
    sex,
    activityLevel,
    goal,
    overrideCaloriesKcal,
    overrideProteinG,
    overrideCarbsG,
    overrideFatG,
  } = profile;

  const complete = Boolean(
    heightCm && weightKg && dateOfBirth && sex && activityLevel
  );

  let calories: number | null = null;
  if (complete) {
    const age = calculateAge(dateOfBirth!, today);
    const bmr = mifflinStJeorBmr(weightKg!, heightCm!, age, sex!);
    const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel!];
    calories = Math.round(tdee * GOAL_FACTORS[goal ?? 'maintain']);
  }
  if (overrideCaloriesKcal != null) calories = overrideCaloriesKcal;

  let protein: number | null =
    weightKg != null && weightKg > 0
      ? Math.round(weightKg * PROTEIN_G_PER_KG)
      : null;
  if (overrideProteinG != null) protein = overrideProteinG;

  let fat: number | null =
    calories != null
      ? Math.round((calories * FAT_CALORIE_SHARE) / KCAL_PER_G_FAT)
      : null;
  if (overrideFatG != null) fat = overrideFatG;

  let carbs: number | null = null;
  if (calories != null && protein != null && fat != null) {
    carbs = Math.max(
      0,
      Math.round(
        (calories - protein * KCAL_PER_G_PROTEIN - fat * KCAL_PER_G_FAT) /
          KCAL_PER_G_CARBS
      )
    );
  }
  if (overrideCarbsG != null) carbs = overrideCarbsG;

  return {
    caloriesKcal: calories,
    proteinG: protein,
    carbsG: carbs,
    fatG: fat,
    fiberG: FIBER_G,
    saltG: SALT_G,
    overridden: {
      calories: overrideCaloriesKcal != null,
      protein: overrideProteinG != null,
      carbs: overrideCarbsG != null,
      fat: overrideFatG != null,
    },
    complete,
  };
}
