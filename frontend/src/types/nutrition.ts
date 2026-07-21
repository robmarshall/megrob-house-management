/**
 * Nutrition profile and target types, mirroring the backend API shapes.
 */

export type Sex = 'male' | 'female'

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active'

export type Goal = 'lose' | 'maintain' | 'gain'

/** The user's own profile — raw fields are only ever visible to their owner. */
export interface NutritionProfile {
  heightCm: number | null
  weightKg: number | null
  /** YYYY-MM-DD */
  dateOfBirth: string | null
  sex: Sex | null
  activityLevel: ActivityLevel | null
  goal: Goal
  overrideCaloriesKcal: number | null
  overrideProteinG: number | null
  overrideCarbsG: number | null
  overrideFatG: number | null
  updatedAt: string
}

export interface NutritionTargets {
  caloriesKcal: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  fiberG: number
  saltG: number
  overridden: {
    calories: boolean
    protein: boolean
    carbs: boolean
    fat: boolean
  }
  /** True when the profile had every input the calorie formula needs */
  complete: boolean
}

export interface NutritionProfileResult {
  profile: NutritionProfile | null
  targets: NutritionTargets | null
}

export interface SaveNutritionProfileInput {
  heightCm?: number | null
  weightKg?: number | null
  dateOfBirth?: string | null
  sex?: Sex | null
  activityLevel?: ActivityLevel | null
  goal?: Goal
  overrideCaloriesKcal?: number | null
  overrideProteinG?: number | null
  overrideCarbsG?: number | null
  overrideFatG?: number | null
}

/** Household member with derived targets only — never raw measurements. */
export interface MemberTargets {
  userId: string
  name: string
  isSelf: boolean
  targets: NutritionTargets | null
}
