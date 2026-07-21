import { Card } from '@/components/atoms/Card'
import type { RecipeNutrition } from '@/types/recipe'

interface NutritionPanelProps {
  nutrition: RecipeNutrition | null | undefined
}

function Value({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-base font-semibold text-gray-900">
        {value !== null ? `${value.toLocaleString()} ${unit}` : '—'}
      </p>
    </div>
  )
}

/**
 * Per-serving nutrition for a recipe. Renders nothing until the enrichment
 * job has produced a row; shows progress/failure states after that.
 */
export function NutritionPanel({ nutrition }: NutritionPanelProps) {
  if (!nutrition) return null

  return (
    <Card className="mt-6">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-xl font-semibold text-gray-900">Nutrition</h2>
          {nutrition.status === 'ready' && nutrition.estimated && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              ~ estimated
            </span>
          )}
        </div>

        {nutrition.status === 'pending' && (
          <p className="text-sm text-gray-500">Calculating nutrition…</p>
        )}

        {nutrition.status === 'failed' && (
          <p className="text-sm text-gray-500">
            Nutrition couldn't be calculated for this recipe's ingredients.
          </p>
        )}

        {nutrition.status === 'ready' && (
          <>
            <p className="text-xs text-gray-500 mb-3">
              Per serving
              {nutrition.matchedCount < nutrition.totalCount &&
                ` — based on ${nutrition.matchedCount} of ${nutrition.totalCount} ingredients`}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              <Value label="Calories" value={nutrition.caloriesKcal} unit="kcal" />
              <Value label="Protein" value={nutrition.proteinG} unit="g" />
              <Value label="Carbs" value={nutrition.carbsG} unit="g" />
              <Value label="Fat" value={nutrition.fatG} unit="g" />
              <Value label="Fibre" value={nutrition.fiberG} unit="g" />
              <Value label="Sugar" value={nutrition.sugarG} unit="g" />
              <Value label="Salt" value={nutrition.saltG} unit="g" />
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
