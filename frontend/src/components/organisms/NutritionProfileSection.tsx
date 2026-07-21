import { useState } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/atoms/Input'
import { Select } from '@/components/atoms/Select'
import { Button } from '@/components/atoms/Button'
import { ErrorMessage } from '@/components/atoms/ErrorMessage'
import { toast } from '@/lib/toast'
import {
  nutritionProfileSchema,
  type NutritionProfileFormData,
} from '@/lib/schemas'
import {
  useNutritionProfile,
  useSaveNutritionProfile,
} from '@/hooks/nutrition/useNutritionProfile'
import type { NutritionTargets } from '@/types/nutrition'

/** register() setValueAs: empty input -> null, otherwise numeric. */
const numberOrNull = (value: unknown) =>
  value === '' || value === null || value === undefined ? null : Number(value)

/** register() setValueAs: empty input -> null, otherwise the string. */
const stringOrNull = (value: unknown) =>
  value === '' || value === undefined ? null : value

function TargetTile({
  label,
  value,
  unit,
  overridden,
}: {
  label: string
  value: number | null
  unit: string
  overridden?: boolean
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-900">
        {value !== null ? `${value.toLocaleString()} ${unit}` : '—'}
      </p>
      {overridden && (
        <p className="text-[10px] uppercase tracking-wide text-primary-600">
          manual
        </p>
      )}
    </div>
  )
}

function TargetsSummary({ targets }: { targets: NutritionTargets }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-gray-700 mb-2">
        Your daily targets
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <TargetTile
          label="Calories"
          value={targets.caloriesKcal}
          unit="kcal"
          overridden={targets.overridden.calories}
        />
        <TargetTile
          label="Protein"
          value={targets.proteinG}
          unit="g"
          overridden={targets.overridden.protein}
        />
        <TargetTile
          label="Carbs"
          value={targets.carbsG}
          unit="g"
          overridden={targets.overridden.carbs}
        />
        <TargetTile
          label="Fat"
          value={targets.fatG}
          unit="g"
          overridden={targets.overridden.fat}
        />
        <TargetTile label="Fibre" value={targets.fiberG} unit="g" />
        <TargetTile label="Salt (max)" value={targets.saltG} unit="g" />
      </div>
      {!targets.complete && (
        <p className="text-xs text-amber-700 mt-2">
          Fill in height, weight, date of birth, sex, and activity level for
          automatic calorie calculation — or set manual overrides below.
        </p>
      )}
      <p className="text-xs text-gray-400 mt-2">
        Estimates based on standard formulas — not medical advice.
      </p>
    </div>
  )
}

const EMPTY_FORM: NutritionProfileFormData = {
  heightCm: null,
  weightKg: null,
  dateOfBirth: null,
  sex: null,
  activityLevel: null,
  goal: 'maintain',
  overrideCaloriesKcal: null,
  overrideProteinG: null,
  overrideCarbsG: null,
  overrideFatG: null,
}

export function NutritionProfileSection() {
  const { data, isLoading } = useNutritionProfile()
  const { save, isSaving } = useSaveNutritionProfile()
  const [formError, setFormError] = useState<string | null>(null)

  const methods = useForm<NutritionProfileFormData>({
    resolver: zodResolver(nutritionProfileSchema),
    defaultValues: EMPTY_FORM,
    values: data?.profile
      ? {
          heightCm: data.profile.heightCm,
          weightKg: data.profile.weightKg,
          dateOfBirth: data.profile.dateOfBirth,
          sex: data.profile.sex,
          activityLevel: data.profile.activityLevel,
          goal: data.profile.goal,
          overrideCaloriesKcal: data.profile.overrideCaloriesKcal,
          overrideProteinG: data.profile.overrideProteinG,
          overrideCarbsG: data.profile.overrideCarbsG,
          overrideFatG: data.profile.overrideFatG,
        }
      : undefined,
  })

  const onSubmit = async (form: NutritionProfileFormData) => {
    setFormError(null)
    try {
      await save({
        ...form,
        sex: form.sex ?? null,
        activityLevel: form.activityLevel ?? null,
      })
      toast.success('Nutrition profile saved')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save nutrition profile'
      setFormError(message)
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Nutrition</h2>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading nutrition profile…</p>
        ) : (
          <>
            {data?.targets && <TargetsSummary targets={data.targets} />}

            <FormProvider {...methods}>
              <form
                onSubmit={methods.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    name="heightCm"
                    label="Height (cm)"
                    type="number"
                    rules={{ setValueAs: numberOrNull }}
                    disabled={isSaving}
                  />
                  <Input
                    name="weightKg"
                    label="Weight (kg)"
                    type="number"
                    inputProps={{ step: '0.1' }}
                    rules={{ setValueAs: numberOrNull }}
                    disabled={isSaving}
                  />
                  <Input
                    name="dateOfBirth"
                    label="Date of birth"
                    type="date"
                    rules={{ setValueAs: stringOrNull }}
                    disabled={isSaving}
                  />
                  <Select name="sex" label="Sex" disabled={isSaving}>
                    <option value="">Not set</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </Select>
                  <Select
                    name="activityLevel"
                    label="Activity level"
                    disabled={isSaving}
                  >
                    <option value="">Not set</option>
                    <option value="sedentary">Sedentary (little exercise)</option>
                    <option value="light">Light (1-3 days/week)</option>
                    <option value="moderate">Moderate (3-5 days/week)</option>
                    <option value="active">Active (6-7 days/week)</option>
                    <option value="very_active">Very active (physical job)</option>
                  </Select>
                  <Select name="goal" label="Goal" disabled={isSaving}>
                    <option value="lose">Lose weight</option>
                    <option value="maintain">Maintain weight</option>
                    <option value="gain">Gain weight</option>
                  </Select>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700">
                    Manual overrides (optional)
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    Set any of these to replace the calculated value.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Input
                      name="overrideCaloriesKcal"
                      label="Calories"
                      type="number"
                      rules={{ setValueAs: numberOrNull }}
                      disabled={isSaving}
                    />
                    <Input
                      name="overrideProteinG"
                      label="Protein (g)"
                      type="number"
                      rules={{ setValueAs: numberOrNull }}
                      disabled={isSaving}
                    />
                    <Input
                      name="overrideCarbsG"
                      label="Carbs (g)"
                      type="number"
                      rules={{ setValueAs: numberOrNull }}
                      disabled={isSaving}
                    />
                    <Input
                      name="overrideFatG"
                      label="Fat (g)"
                      type="number"
                      rules={{ setValueAs: numberOrNull }}
                      disabled={isSaving}
                    />
                  </div>
                </div>

                {formError && <ErrorMessage message={formError} />}

                <p className="text-xs text-gray-400">
                  Your measurements are private to you — household members only
                  ever see your daily targets.
                </p>

                <Button type="submit" isLoading={isSaving}>
                  Save Nutrition Profile
                </Button>
              </form>
            </FormProvider>
          </>
        )}
      </div>
    </section>
  )
}
