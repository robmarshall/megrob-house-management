import { useState } from "react";
import { Card } from "@/components/atoms/Card";
import { IconButton } from "@/components/atoms/IconButton";
import { ConfirmDeleteBottomSheet } from "@/components/molecules/ConfirmDeleteBottomSheet";
import type { ShoppingList } from "@/types/shoppingList";
import { motion } from "framer-motion";

interface ShoppingListCardProps {
  list: ShoppingList;
  onClick: () => void;
  onDelete?: (listId: number) => void;
}

export function ShoppingListCard({
  list,
  onClick,
  onDelete,
}: ShoppingListCardProps) {
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(list.id);
      setIsDeleteConfirmOpen(false);
    } catch (error) {
      console.error("Failed to delete list:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        variant="elevated"
        padding="lg"
        className="cursor-pointer hover:shadow-xl transition-shadow"
        onClick={onClick}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate mb-1">
              {list.name}
            </h3>

            {list.description && (
              <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                {list.description}
              </p>
            )}
          </div>

          {onDelete && (
            <IconButton
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              aria-label={`Delete ${list.name}`}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg
                className="w-4 h-4"
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
        </div>
      </Card>

      <ConfirmDeleteBottomSheet
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        itemName={list.name}
        itemType="shopping list"
        isDeleting={isDeleting}
      />
    </motion.div>
  );
}
