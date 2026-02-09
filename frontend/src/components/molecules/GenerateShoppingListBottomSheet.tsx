import { useState } from 'react';
import { useNavigate } from 'react-router';
import BottomSheet from '@/components/atoms/BottomSheet';
import { Button } from '@/components/atoms/Button';
import { useMealPlanData } from '@/hooks/mealPlan/useMealPlans';
import { usePaginatedData } from '@/hooks/usePaginatedData';
import { cn } from '@/lib/utils';
import type { ShoppingList } from '@/types/shoppingList';

type GenerateMode = 'new' | 'existing';

interface GenerateShoppingListBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  mealPlanId?: number;
}

function getDefaultListName(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `Groceries - Week of ${now.toLocaleDateString('en-US', options)}`;
}

export default function GenerateShoppingListBottomSheet({
  isOpen,
  onClose,
  mealPlanId,
}: GenerateShoppingListBottomSheetProps) {
  const navigate = useNavigate();
  const { toShoppingList, isLoading: isMealPlanLoading } = useMealPlanData();
  const { data: lists } = usePaginatedData<ShoppingList>('shopping-lists', { pageSize: 50 });

  const [mode, setMode] = useState<GenerateMode>('new');
  const [newListName, setNewListName] = useState(getDefaultListName);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    mealPlanId !== undefined &&
    (mode === 'new' ? newListName.trim().length > 0 : selectedListId !== null);

  const handleGenerate = async () => {
    if (!canSubmit || mealPlanId === undefined) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const input =
        mode === 'new'
          ? { newListName: newListName.trim() }
          : { shoppingListId: selectedListId! };

      const result = await toShoppingList(mealPlanId, input);
      onClose();
      navigate(`/shopping-lists/${result.id}`);
    } catch (err) {
      if (err && typeof err === 'object' && 'message' in err) {
        setError((err as { message: string }).message);
      } else {
        setError('Failed to generate shopping list. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setMode('new');
    setNewListName(getDefaultListName());
    setSelectedListId(null);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Generate Shopping List">
      <div className="flex flex-col gap-4">
        {/* Mode Toggle */}
        <div className="flex gap-2 rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setMode('new')}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              mode === 'new'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            New List
          </button>
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              mode === 'existing'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Existing List
          </button>
        </div>

        {/* New List Mode */}
        {mode === 'new' && (
          <div>
            <label
              htmlFor="newListName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              List Name
            </label>
            <input
              id="newListName"
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Enter a name for the new list..."
              disabled={isSubmitting}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        )}

        {/* Existing List Mode */}
        {mode === 'existing' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select a Shopping List
            </label>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
              {lists.length === 0 && (
                <p className="p-4 text-sm text-gray-500 text-center">
                  No shopping lists found. Create a new one instead.
                </p>
              )}
              {lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => setSelectedListId(list.id)}
                  disabled={isSubmitting}
                  className={cn(
                    'flex w-full items-center px-3 py-2.5 text-left transition-colors border-b border-gray-100 last:border-b-0',
                    selectedListId === list.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'hover:bg-gray-50',
                    isSubmitting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{list.name}</p>
                    {list.description && (
                      <p className="text-xs text-gray-500 truncate">{list.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
            {selectedListId !== null && (
              <p className="mt-2 text-sm text-primary-700">
                Selected:{' '}
                <span className="font-medium">
                  {lists.find((l) => l.id === selectedListId)?.name}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canSubmit || isSubmitting || isMealPlanLoading}
            isLoading={isSubmitting}
            onClick={handleGenerate}
            className="flex-1"
          >
            Generate List
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
