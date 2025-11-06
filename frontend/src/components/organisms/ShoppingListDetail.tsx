import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { PlusIcon, PencilIcon } from "@heroicons/react/24/outline";
import { ListHeader } from "@/components/molecules/ListHeader";
import AddItemBottomSheet from "@/components/molecules/AddItemBottomSheet";
import { ConfirmDeleteBottomSheet } from "@/components/molecules/ConfirmDeleteBottomSheet";
import { ShoppingListItem } from "@/components/molecules/ShoppingListItem";
import { EmptyState } from "@/components/molecules/EmptyState";
import { IconButton } from "@/components/atoms/IconButton";
import { Button } from "@/components/atoms/Button";
import type { ShoppingList } from "@/types/shoppingList";
import type { BadgeVariant } from "@/components/atoms/Badge";

import EditListBottomSheet from "@/components/molecules/EditListBottomSheet";
import type { UpdateShoppingListFormData } from "@/lib/schemas";

interface ShoppingListDetailProps {
  list: ShoppingList;
  onBack?: () => void;
  onAddItem: (name: string, category?: BadgeVariant) => Promise<void>;
  onToggleItem: (itemId: number) => Promise<void>;
  onDeleteItem: (itemId: number) => Promise<void>;
  onEditList?: (data: UpdateShoppingListFormData) => Promise<void>;
  onDeleteList?: () => Promise<void>;
}

export function ShoppingListDetail({
  list,
  onBack,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onEditList,
  onDeleteList,
}: ShoppingListDetailProps) {
  const items = list.items || [];
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!onDeleteList) return;

    setIsDeleting(true);
    try {
      await onDeleteList();
      setIsDeleteConfirmOpen(false);
    } catch (error) {
      console.error("Failed to delete list:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditList = async (data: UpdateShoppingListFormData) => {
    if (!onEditList) return;
    await onEditList(data);
    setIsEditSheetOpen(false);
  };

  // Group items by category and sort alphabetically
  const groupedItems = items.reduce((acc, item) => {
    const category = item.category
      ? item.category.charAt(0).toUpperCase() +
        item.category.slice(1).toLowerCase()
      : "Uncategorized";

    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  // Sort categories alphabetically
  const sortedCategories = Object.keys(groupedItems).sort();

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0 },
  };

  return (
    <>
      <div className="max-w-4xl mx-auto pb-24">
        <ListHeader
          title={list.name}
          description={list.description ?? undefined}
          onBack={onBack}
          actions={
            <>
              {onEditList && (
                <IconButton
                  size="md"
                  onClick={() => setIsEditSheetOpen(true)}
                  aria-label="Edit list"
                >
                  <PencilIcon className="w-5 h-5" />
                </IconButton>
              )}
              {onDeleteList && (
                <IconButton
                  variant="danger"
                  size="md"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  aria-label="Delete list"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </IconButton>
              )}
            </>
          }
        />

        {items.length === 0 ? (
          <EmptyState
            icon={
              <svg
                className="w-12 h-12"
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
            title="No items yet"
            description="Add your first item to get started"
          />
        ) : (
          <div className="space-y-6">
            {sortedCategories.map((category) => (
              <div key={category}>
                <h2 className="text-lg font-semibold text-gray-900 mb-3 px-1">
                  {category}
                </h2>
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {groupedItems[category].map((item) => (
                      <motion.div
                        key={item.id}
                        variants={itemVariants}
                        initial="hidden"
                        animate="show"
                        exit="hidden"
                        layout
                      >
                        <ShoppingListItem
                          item={item}
                          onToggle={onToggleItem}
                          onDelete={onDeleteItem}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          variant="primary"
          onClick={() => setIsAddSheetOpen(true)}
          className="rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
          aria-label="Add item"
        >
          <PlusIcon className="h-6 w-6" />
        </Button>
      </div>

      {/* Bottom Sheet for Adding Items */}
      <AddItemBottomSheet
        isOpen={isAddSheetOpen}
        onClose={() => setIsAddSheetOpen(false)}
        onAdd={onAddItem}
      />

      {/* Bottom Sheet for Editing List */}
      {onEditList && (
        <EditListBottomSheet
          isOpen={isEditSheetOpen}
          onClose={() => setIsEditSheetOpen(false)}
          onEdit={handleEditList}
          currentName={list.name}
          currentDescription={list.description}
        />
      )}

      {/* Confirmation for Deleting List */}
      <ConfirmDeleteBottomSheet
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        itemName={list.name}
        itemType="shopping list"
        isDeleting={isDeleting}
        warningMessage="Deleting this list will also permanently remove all items in it. This action cannot be undone."
      />
    </>
  );
}
