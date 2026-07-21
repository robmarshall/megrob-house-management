/**
 * Nutrition profile service.
 *
 * Privacy model: raw profile fields (height, weight, DOB, sex) are only ever
 * returned to the OWNING user via getOwnNutritionProfile. Household members
 * see derived daily targets only (getHouseholdNutritionTargets) — never the
 * measurements they were computed from.
 */

import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { nutritionProfiles, householdMembers, user } from '../db/schema.js';
import { getUserHouseholdId } from '../lib/household.js';
import {
  computeNutritionTargets,
  type NutritionProfileInput,
  type NutritionTargets,
  type Sex,
  type ActivityLevel,
  type Goal,
} from '../lib/nutritionTargets.js';

type ProfileRow = typeof nutritionProfiles.$inferSelect;

/** API shape of a profile: numeric weight, no internal ids. */
export interface NutritionProfileView {
  heightCm: number | null;
  weightKg: number | null;
  dateOfBirth: string | null;
  sex: Sex | null;
  activityLevel: ActivityLevel | null;
  goal: Goal;
  overrideCaloriesKcal: number | null;
  overrideProteinG: number | null;
  overrideCarbsG: number | null;
  overrideFatG: number | null;
  updatedAt: Date;
}

export interface OwnProfileResult {
  profile: NutritionProfileView | null;
  targets: NutritionTargets | null;
}

export interface MemberTargets {
  userId: string;
  name: string;
  isSelf: boolean;
  /** Null when the member has not filled in a profile yet */
  targets: NutritionTargets | null;
}

function toView(row: ProfileRow): NutritionProfileView {
  return {
    heightCm: row.heightCm,
    weightKg: row.weightKg ? parseFloat(row.weightKg) : null,
    dateOfBirth: row.dateOfBirth,
    sex: (row.sex as Sex | null) ?? null,
    activityLevel: (row.activityLevel as ActivityLevel | null) ?? null,
    goal: row.goal as Goal,
    overrideCaloriesKcal: row.overrideCaloriesKcal,
    overrideProteinG: row.overrideProteinG,
    overrideCarbsG: row.overrideCarbsG,
    overrideFatG: row.overrideFatG,
    updatedAt: row.updatedAt,
  };
}

function toTargetsInput(row: ProfileRow): NutritionProfileInput {
  return {
    heightCm: row.heightCm,
    weightKg: row.weightKg ? parseFloat(row.weightKg) : null,
    dateOfBirth: row.dateOfBirth,
    sex: row.sex as Sex | null,
    activityLevel: row.activityLevel as ActivityLevel | null,
    goal: row.goal as Goal,
    overrideCaloriesKcal: row.overrideCaloriesKcal,
    overrideProteinG: row.overrideProteinG,
    overrideCarbsG: row.overrideCarbsG,
    overrideFatG: row.overrideFatG,
  };
}

/** The requesting user's own profile with computed targets. */
export async function getOwnNutritionProfile(
  userId: string
): Promise<OwnProfileResult> {
  const [row] = await db
    .select()
    .from(nutritionProfiles)
    .where(eq(nutritionProfiles.userId, userId));

  if (!row) return { profile: null, targets: null };
  return { profile: toView(row), targets: computeNutritionTargets(toTargetsInput(row)) };
}

export interface UpsertProfileInput {
  heightCm?: number | null;
  weightKg?: number | null;
  dateOfBirth?: string | null;
  sex?: Sex | null;
  activityLevel?: ActivityLevel | null;
  goal?: Goal;
  overrideCaloriesKcal?: number | null;
  overrideProteinG?: number | null;
  overrideCarbsG?: number | null;
  overrideFatG?: number | null;
}

/**
 * Create or update the user's own profile. Only fields passed as
 * non-undefined change; explicit nulls clear a field.
 */
export async function upsertNutritionProfile(
  userId: string,
  input: UpsertProfileInput
): Promise<OwnProfileResult> {
  const values = {
    heightCm: input.heightCm,
    weightKg:
      input.weightKg === undefined
        ? undefined
        : input.weightKg === null
          ? null
          : input.weightKg.toString(),
    dateOfBirth: input.dateOfBirth,
    sex: input.sex,
    activityLevel: input.activityLevel,
    goal: input.goal,
    overrideCaloriesKcal: input.overrideCaloriesKcal,
    overrideProteinG: input.overrideProteinG,
    overrideCarbsG: input.overrideCarbsG,
    overrideFatG: input.overrideFatG,
  };

  // Strip undefined so partial updates don't blank omitted columns
  const changed = Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== undefined)
  );

  const [row] = await db
    .insert(nutritionProfiles)
    .values({ userId, ...changed })
    .onConflictDoUpdate({
      target: nutritionProfiles.userId,
      set: { ...changed, updatedAt: new Date() },
    })
    .returning();

  return { profile: toView(row), targets: computeNutritionTargets(toTargetsInput(row)) };
}

/**
 * Derived daily targets for everyone in the requesting user's household
 * (or just the user when they have no household). Never exposes raw
 * measurements. Members without a profile appear with targets: null so the
 * UI can prompt them to fill one in.
 */
export async function getHouseholdNutritionTargets(
  userId: string
): Promise<MemberTargets[]> {
  const householdId = await getUserHouseholdId(userId);

  let members: { userId: string; name: string }[];
  if (householdId) {
    members = await db
      .select({ userId: householdMembers.userId, name: user.name })
      .from(householdMembers)
      .innerJoin(user, eq(householdMembers.userId, user.id))
      .where(eq(householdMembers.householdId, householdId));
  } else {
    const [self] = await db
      .select({ userId: user.id, name: user.name })
      .from(user)
      .where(eq(user.id, userId));
    members = self ? [self] : [];
  }

  if (members.length === 0) return [];

  const rows = await db
    .select()
    .from(nutritionProfiles)
    .where(
      inArray(
        nutritionProfiles.userId,
        members.map((m) => m.userId)
      )
    );
  const profileByUser = new Map(rows.map((r) => [r.userId, r]));

  return members.map((member) => {
    const row = profileByUser.get(member.userId);
    return {
      userId: member.userId,
      name: member.name,
      isSelf: member.userId === userId,
      targets: row ? computeNutritionTargets(toTargetsInput(row)) : null,
    };
  });
}
