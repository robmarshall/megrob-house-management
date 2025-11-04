import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { ListHeader } from "@/components/molecules/ListHeader";
import AddItemBottomSheet from "@/components/molecules/AddItemBottomSheet";
import { ShoppingListItem } from "@/components/molecules/ShoppingListItem";
import { EmptyState } from "@/components/molecules/EmptyState";
import { IconButton } from "@/components/atoms/IconButton";
import { Button } from "@/components/atoms/Button";
import type { ShoppingList } from "@/types/shoppingList";

interface ShoppingListDetailProps {
  list: ShoppingList;
  onBack?: () => void;
  onAddItem: (name: string, category?: string) => Promise<void>;
  onToggleItem: (itemId: number) => Promise<void>;
  onDeleteItem: (itemId: number) => Promise<void>;
  onDeleteList?: () => Promise<void>;
}

export function ShoppingListDetail({
  list,
  onBack,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onDeleteList,
}: ShoppingListDetailProps) {
  const items = list.items || [];
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);

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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

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
              {onDeleteList && (
                <IconButton
                  variant="danger"
                  size="md"
                  onClick={onDeleteList}
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
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="space-y-2"
                >
                  <AnimatePresence>
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
                </motion.div>
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
    </>
  );
}
