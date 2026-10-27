import { useState } from "react";
import { useNavigate } from "react-router";
import { PlusIcon } from "@heroicons/react/24/outline";
import { MainLayout } from "@/components/templates/MainLayout";
import { ShoppingListCard } from "@/components/organisms/ShoppingListCard";
import { EmptyState } from "@/components/molecules/EmptyState";
import { Pagination } from "@/components/molecules/Pagination";
import { Button } from "@/components/atoms/Button";
import {
  useShoppingLists,
  useShoppingListData,
} from "@/hooks/shoppingList/useShoppingLists";
import { uniqueListName } from "@/lib/listNames";

/** Base name for a freshly created list ("Shopping", "Shopping 2", …); the user can rename it from the list page. */
const DEFAULT_LIST_NAME = "Shopping";

export function ShoppingListsPage() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const { data: lists, isLoading, error, page, totalPages, goToPage } = useShoppingLists();
  const { create, delete: deleteList } = useShoppingListData();

  // Creating a list is a single tap: no name/description form up front. The
  // list gets a default name and the user lands on it with the add-item sheet
  // already open, since adding items is the whole point.
  const handleNewList = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      // Dedupes against the lists currently loaded (the page being viewed), which
      // covers the common case of a handful of lists per household.
      const name = uniqueListName(DEFAULT_LIST_NAME, lists.map((list) => list.name));
      const newList = await create({ name }, { silent: true });
      navigate(`/shopping-lists/${newList.id}`, { state: { addItem: true } });
    } catch {
      // Error toast handled by useData hook
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteList = async (listId: number) => {
    await deleteList(listId);
  };

  const handleOpenList = (listId: number) => {
    navigate(`/shopping-lists/${listId}`);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
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
            <p className="text-sm text-gray-600">Loading lists...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Failed to load shopping lists
            </h3>
            <p className="text-sm text-gray-500">{error.message}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Shopping Lists</h1>
          <p className="mt-1 text-sm text-gray-500">
            Organize your shopping with multiple lists
          </p>
        </div>

        {lists.length === 0 ? (
          <EmptyState
            icon={
              <svg
                className="w-16 h-16"
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
            }
            title="No shopping lists yet"
            description="Create your first shopping list to get started organizing your shopping"
            action={{
              label: "New list",
              onClick: handleNewList,
            }}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {lists.map((list) => (
                <ShoppingListCard
                  key={list.id}
                  list={list}
                  onClick={() => handleOpenList(list.id)}
                  onDelete={handleDeleteList}
                />
              ))}
            </div>

            <div className="mt-8">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={goToPage}
              />
            </div>
          </>
        )}

        {/* Floating Action Button */}
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            onClick={handleNewList}
            variant="primary"
            isLoading={isCreating}
            className="rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
            aria-label="New list"
          >
            <PlusIcon className="h-6 w-6" />
          </Button>
        </div>
    </MainLayout>
  );
}
