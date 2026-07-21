import { Card } from '@/components/atoms/Card'
import { cn } from '@/lib/utils'
import {
  sumEntryNutrition,
  averageDailyNutrition,
  percentOfTarget,
} from '@/lib/mealPlanNutrition'
import type { MealPlanEntry } from '@/types/mealPlan'
import type { MemberTargets } from '@/types/nutrition'

function firstName(name: string): string {
  return name.split(' ')[0]
}

function pctClass(pct: number): string {
  if (pct < 70) return 'bg-gray-100 text-gray-600'
  if (pct <= 110) return 'bg-green-100 text-green-700'
  return 'bg-amber-100 text-amber-700'
}

function MemberPctChip({
  name,
  pct,
}: {
  name: string
  pct: number
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        pctClass(pct)
      )}
    >
      {firstName(name)} {pct}%
    </span>
  )
}

interface DayNutritionSummaryProps {
  entries: MealPlanEntry[]
  members: MemberTargets[]
}

/**
 * Compact one-line footer for a day card: total calories/protein of the
 * day's planned meals, plus each member's percentage of their calorie
 * target. Renders nothing when no entry has nutrition data.
 */
export function DayNutritionSummary({ entries, members }: DayNutritionSummaryProps) {
  const totals = sumEntryNutrition(entries)
  if (totals.countedEntries === 0) return null

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
      <span>
        ≈ {Math.round(totals.caloriesKcal).toLocaleString()} kcal ·{' '}
        {Math.round(totals.proteinG)} g protein
        {totals.estimated && ' (est.)'}
      </span>
      {totals.uncountedEntries > 0 && (
        <span className="text-gray-400">
          {totals.uncountedEntries} meal{totals.uncountedEntries > 1 ? 's' : ''} not counted
        </span>
      )}
      {members.map((member) => {
        const pct = member.targets
          ? percentOfTarget(totals.caloriesKcal, member.targets.caloriesKcal)
          : null
        if (pct === null) return null
        return <MemberPctChip key={member.userId} name={member.name} pct={pct} />
      })}
    </div>
  )
}

interface WeekNutritionSummaryProps {
  entries: MealPlanEntry[]
  members: MemberTargets[]
}

/**
 * Week roll-up card: average daily calories/protein over planned days,
 * compared per member against their daily targets. Renders nothing when the
 * plan has no nutrition data yet.
 */
export function WeekNutritionSummary({ entries, members }: WeekNutritionSummaryProps) {
  const avg = averageDailyNutrition(entries)
  if (avg.daysCounted === 0) return null

  const membersWithTargets = members.filter((m) => m.targets?.caloriesKcal)

  return (
    <Card padding="md" className="mb-4">
      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide mb-2">
        Week nutrition
      </h3>
      <p className="text-sm text-gray-600 mb-2">
        Averaging ≈ {Math.round(avg.caloriesKcal).toLocaleString()} kcal ·{' '}
        {Math.round(avg.proteinG)} g protein per planned day
        {avg.estimated && ' (partly estimated)'}
        {avg.daysCounted < 7 && ` — ${avg.daysCounted} of 7 days have data`}
      </p>
      {membersWithTargets.length > 0 && (
        <ul className="space-y-1">
          {membersWithTargets.map((member) => {
            const t = member.targets!
            const kcalPct = percentOfTarget(avg.caloriesKcal, t.caloriesKcal)
            const proteinPct = percentOfTarget(avg.proteinG, t.proteinG)
            return (
              <li key={member.userId} className="text-sm text-gray-700">
                <span className="font-medium">{firstName(member.name)}</span>
                {kcalPct !== null && ` — ${kcalPct}% of calories`}
                {proteinPct !== null && `, ${proteinPct}% of protein`}
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs text-gray-400 mt-2">
        Assumes everyone eats one serving of each planned meal. Estimates, not
        medical advice.
      </p>
    </Card>
  )
}
