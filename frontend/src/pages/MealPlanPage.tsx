import { useState } from 'react'
import { useNavigate } from 'react-router'
import { MainLayout } from '@/components/templates/MainLayout'
import { ListHeader } from '@/components/molecules/ListHeader'
import { EmptyState } from '@/components/molecules/EmptyState'
import { Button } from '@/components/atoms/Button'
import { Card } from '@/components/atoms/Card'
import { IconButton } from '@/components/atoms/IconButton'
import { ConfirmDeleteBottomSheet } from '@/components/molecules/ConfirmDeleteBottomSheet'
import { useMealPlan, useMealPlanData } from '@/hooks/mealPlan/useMealPlans'
import AddMealEntryBottomSheet from '@/components/molecules/AddMealEntryBottomSheet'
import GenerateShoppingListBottomSheet from '@/components/molecules/GenerateShoppingListBottomSheet'
import type { MealType, MealPlanEntry, CreateMealPlanEntryInput } from '@/types/mealPlan'
import { MEAL_TYPES, MEAL_TYPE_LABELS, DAY_LABELS } from '@/types/mealPlan'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  ShoppingCartIcon,
  DocumentDuplicateIcon,
  CalendarIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatWeekDate(date: Date): string {
  return date.toISOString().split('T')[0] // YYYY-MM-DD
}

function addWeeks(date: Date, weeks: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + weeks * 7)
  return result
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getDayDate(weekStart: Date, dayOfWeek: number): string {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + dayOfWeek)
  return formatWeekDate(d)
}

function getWeekEndDate(weekStart: Date): string {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + 6)
  return formatWeekDate(d)
}

// ---------------------------------------------------------------------------
// MealSlot (inline component)
// ---------------------------------------------------------------------------

function MealSlot({
  mealType,
  entries,
  onAdd,
  onDelete,
}: {
  mealType: MealType
  entries: MealPlanEntry[]
  onAdd: () => void
  onDelete: (entryId: number) => void
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 min-h-[80px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase">
          {MEAL_TYPE_LABELS[mealType]}
        </span>
        <button
          onClick={onAdd}
          className="text-primary-600 hover:text-primary-700 p-0.5 rounded hover:bg-primary-50"
          aria-label={`Add ${MEAL_TYPE_LABELS[mealType]}`}
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>
      {entries.length === 0 ? (
        <button
          onClick={onAdd}
          className="w-full text-center text-xs text-gray-400 py-2 border border-dashed border-gray-300 rounded hover:border-primary-300 hover:text-primary-500 transition-colors"
        >
          Add meal
        </button>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 bg-white rounded px-2 py-1.5 shadow-sm text-sm group"
            >
              {entry.recipeImageUrl && (
                <img
                  src={entry.recipeImageUrl}
                  alt=""
                  className="w-6 h-6 rounded object-cover flex-shrink-0"
                />
              )}
              <span className="flex-1 truncate text-gray-700">
                {entry.recipeName || entry.customText || 'Untitled'}
              </span>
              <button
                onClick={() => onDelete(entry.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-0.5"
                aria-label="Remove meal entry"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton for the weekly grid
// ---------------------------------------------------------------------------

function WeekGridSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <Card key={i} padding="md">
          <div className="animate-pulse">
            <div className="h-4 w-28 bg-gray-200 rounded mb-3" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="bg-gray-50 rounded-lg p-3 min-h-[80px]">
                  <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
                  <div className="h-8 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MealPlanPage
// ---------------------------------------------------------------------------

export function MealPlanPage() {
  const navigate = useNavigate()

  // Week navigation state
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()))

  // Meal plan data
  const { data: mealPlan, isLoading } = useMealPlan(formatWeekDate(weekStart))
  const {
    createPlan,
    addEntry,
    deleteEntry,
    deletePlan,
    copyWeek,
    isLoading: isMutating,
  } = useMealPlanData()

  // Bottom sheet states
  const [isAddMealOpen, setIsAddMealOpen] = useState(false)
  const [isShoppingListOpen, setIsShoppingListOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{
    dayOfWeek: number
    mealType: MealType
  } | null>(null)

  // Derived values
  const weekEndDateStr = getWeekEndDate(weekStart)
  const weekStartDateStr = formatWeekDate(weekStart)
  const weekDescription = `Week of ${formatDisplayDate(weekStartDateStr)} - ${formatDisplayDate(weekEndDateStr)}`
  const hasRecipeEntries =
    mealPlan?.entries?.some((e) => e.recipeId != null) ?? false

  // Handlers
  const handleCreatePlan = async () => {
    await createPlan({ weekStartDate: formatWeekDate(weekStart) })
  }

  const handleAddEntry = async (input: CreateMealPlanEntryInput) => {
    if (!mealPlan) return
    await addEntry(mealPlan.id, input)
    setIsAddMealOpen(false)
    setSelectedSlot(null)
  }

  const handleDeletePlan = async () => {
    if (!mealPlan) return
    setIsDeleting(true)
    try {
      await deletePlan(mealPlan.id)
      setIsDeleteConfirmOpen(false)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCopyPreviousWeek = async () => {
    await copyWeek({
      sourceWeek: formatWeekDate(addWeeks(weekStart, -1)),
      targetWeek: formatWeekDate(weekStart),
    })
  }

  const handleGoToToday = () => {
    setWeekStart(getMonday(new Date()))
  }

  const getEntriesForSlot = (
    dayOfWeek: number,
    mealType: MealType
  ): MealPlanEntry[] => {
    if (!mealPlan?.entries) return []
    return mealPlan.entries.filter(
      (e) => e.dayOfWeek === dayOfWeek && e.mealType === mealType
    )
  }

  // Header action buttons
  const headerActions = (
    <>
      {!mealPlan && !isLoading && (
        <IconButton
          variant="ghost"
          size="sm"
          onClick={handleCopyPreviousWeek}
          disabled={isMutating}
          aria-label="Copy previous week"
        >
          <DocumentDuplicateIcon className="w-5 h-5" />
        </IconButton>
      )}
      {mealPlan && hasRecipeEntries && (
        <IconButton
          variant="ghost"
          size="sm"
          onClick={() => setIsShoppingListOpen(true)}
          aria-label="Generate shopping list"
        >
          <ShoppingCartIcon className="w-5 h-5" />
        </IconButton>
      )}
      {mealPlan && (
        <IconButton
          variant="danger"
          size="sm"
          onClick={() => setIsDeleteConfirmOpen(true)}
          disabled={isMutating}
          aria-label="Delete meal plan"
        >
          <TrashIcon className="w-5 h-5" />
        </IconButton>
      )}
    </>
  )

  return (
    <MainLayout>
      <ListHeader
        title="Meal Planning"
        description={weekDescription}
        onBack={() => navigate('/')}
        actions={headerActions}
      />

      {/* Week navigation bar */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <IconButton
          variant="ghost"
          size="sm"
          onClick={() => setWeekStart(addWeeks(weekStart, -1))}
          aria-label="Previous week"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </IconButton>

        <div className="flex items-center gap-3 text-sm text-gray-700">
          <span className="font-medium">
            {formatDisplayDate(weekStartDateStr)} -{' '}
            {formatDisplayDate(weekEndDateStr)}
          </span>
          <Button variant="secondary" size="sm" onClick={handleGoToToday}>
            Today
          </Button>
        </div>

        <IconButton
          variant="ghost"
          size="sm"
          onClick={() => setWeekStart(addWeeks(weekStart, 1))}
          aria-label="Next week"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </IconButton>
      </div>

      {/* Weekly grid */}
      {isLoading ? (
        <WeekGridSkeleton />
      ) : !mealPlan ? (
        <EmptyState
          icon={<CalendarIcon className="w-12 h-12" />}
          title="No meal plan for this week"
          description="Create a meal plan to start organizing your meals"
          action={{ label: 'Create Plan', onClick: handleCreatePlan }}
        />
      ) : (
        <div className="space-y-4">
          {[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => (
            <Card key={dayOfWeek} padding="md">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">
                {DAY_LABELS[dayOfWeek]}
                <span className="text-gray-400 font-normal ml-2">
                  {formatDisplayDate(getDayDate(weekStart, dayOfWeek))}
                </span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {MEAL_TYPES.map((mealType) => {
                  const entries = getEntriesForSlot(dayOfWeek, mealType)
                  return (
                    <MealSlot
                      key={mealType}
                      mealType={mealType}
                      entries={entries}
                      onAdd={() => {
                        setSelectedSlot({ dayOfWeek, mealType })
                        setIsAddMealOpen(true)
                      }}
                      onDelete={(entryId) =>
                        deleteEntry(mealPlan.id, entryId)
                      }
                    />
                  )
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Bottom sheets */}
      <AddMealEntryBottomSheet
        isOpen={isAddMealOpen}
        onClose={() => {
          setIsAddMealOpen(false)
          setSelectedSlot(null)
        }}
        onSubmit={handleAddEntry}
        defaultDayOfWeek={selectedSlot?.dayOfWeek}
        defaultMealType={selectedSlot?.mealType}
      />

      <GenerateShoppingListBottomSheet
        isOpen={isShoppingListOpen}
        onClose={() => setIsShoppingListOpen(false)}
        mealPlanId={mealPlan?.id}
      />

      <ConfirmDeleteBottomSheet
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeletePlan}
        itemName={mealPlan?.name || `Week of ${formatDisplayDate(weekStartDateStr)}`}
        itemType="meal plan"
        isDeleting={isDeleting}
        warningMessage="This will permanently delete the entire meal plan for this week, including all meal entries. This action cannot be undone."
      />
    </MainLayout>
  )
}
