import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ListHeader } from "@/components/molecules/ListHeader";
import { AddItemInput } from "@/components/molecules/AddItemInput";
import { ShoppingListItem } from "@/components/molecules/ShoppingListItem";
import { EmptyState } from "@/components/molecules/EmptyState";
import { IconButton } from "@/components/atoms/IconButton";
import type { ShoppingList } from "@/types/shoppingList";

interface ShoppingListDetailProps {
  list: ShoppingList;
  onBack?: () => void;
  onAddItem: (name: string, category?: string) => Promise<void>;
  onToggleItem: (itemId: number) => Promise<void>;
  onDeleteItem: (itemId: number) => Promise<void>;
  onDeleteList?: () => Promise<void>;
}

type FilterType = "all" | "active" | "completed";

export function ShoppingListDetail({
  list,
  onBack,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onDeleteList,
}: ShoppingListDetailProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const items = list.items || [];

  // Apply filters
  const filteredItems = items.filter((item) => {
    if (filter === "active" && item.checked) return false;
    if (filter === "completed" && !item.checked) return false;
    if (categoryFilter && item.category?.toLowerCase() !== categoryFilter.toLowerCase()) return false;
    return true;
  });

  // Get unique categories with normalized capitalization
  const categories = Array.from(
    new Set(
      items
        .map((item) => item.category)
        .filter(Boolean)
        .map((cat) => cat!.charAt(0).toUpperCase() + cat!.slice(1).toLowerCase())
    )
  ) as string[];

  const checkedCount = items.filter((item) => item.checked).length;
  const totalCount = items.length;

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
    <div className="max-w-4xl mx-auto">
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

      <div className="mb-6">
        <AddItemInput onAdd={onAddItem} />
      </div>

      {totalCount > 0 && (
        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                filter === "all"
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setFilter("active")}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                filter === "active"
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Active ({totalCount - checkedCount})
            </button>
            <button
              onClick={() => setFilter("completed")}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                filter === "completed"
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Completed ({checkedCount})
            </button>
          </div>

          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1 rounded-md border border-gray-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {filteredItems.length === 0 ? (
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
          title={
            items.length === 0 ? "No items yet" : "No items match your filters"
          }
          description={
            items.length === 0
              ? "Add your first item to get started"
              : "Try adjusting your filters to see more items"
          }
        />
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-2"
        >
          <AnimatePresence>
            {filteredItems.map((item) => (
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
      )}
    </div>
  );
}
