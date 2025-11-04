import { useParams, useNavigate } from "react-router";
import { ShoppingListDetail } from "@/components/organisms/ShoppingListDetail";
import {
  useShoppingList,
  useShoppingListData,
} from "@/hooks/shoppingList/useShoppingLists";
import {
  useShoppingListItems,
  useShoppingListItemData,
} from "@/hooks/shoppingList/useShoppingListItems";

export function ShoppingListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const listId = parseInt(id || "0", 10);

  const { data: list, isLoading: listLoading } = useShoppingList(listId);
  const { data: items, isLoading: itemsLoading } = useShoppingListItems(listId);
  const { create: createItem, edit: editItem, delete: deleteItem } =
    useShoppingListItemData(listId);
  const { delete: deleteList } = useShoppingListData();

  const isLoading = listLoading || itemsLoading;

  const handleAddItem = async (name: string, category?: string) => {
    await createItem({
      name,
      category,
      quantity: 1,
      checked: false,
    });
  };

  const handleToggleItem = async (itemId: number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    await editItem(itemId, { checked: !item.checked });
  };

  const handleDeleteItem = async (itemId: number) => {
    await deleteItem(itemId);
  };

  const handleDeleteList = async () => {
    if (confirm(`Delete "${list?.name}"? This cannot be undone.`)) {
      await deleteList(listId);
      navigate("/shopping-lists");
    }
  };

  const handleBack = () => {
    navigate("/shopping-lists");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin h-8 w-8 text-primary-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-sm text-gray-600">Loading list...</p>
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            List not found
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            The shopping list you're looking for doesn't exist.
          </p>
          <button
            onClick={handleBack}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            ← Back to Lists
          </button>
        </div>
      </div>
    );
  }

  // Combine list with items
  const listWithItems = {
    ...list,
    items,
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ShoppingListDetail
          list={listWithItems}
          onBack={handleBack}
          onAddItem={handleAddItem}
          onToggleItem={handleToggleItem}
          onDeleteItem={handleDeleteItem}
          onDeleteList={handleDeleteList}
        />
      </div>
    </div>
  );
}
