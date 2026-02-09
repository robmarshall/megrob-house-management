import { useState } from "react";
import { ControlledCheckbox } from "@/components/atoms/ControlledCheckbox";
import { IconButton } from "@/components/atoms/IconButton";
import { cn } from "@/lib/utils";
import type { ShoppingListItem as ShoppingListItemType } from "@/types/shoppingList";

interface ShoppingListItemProps {
  item: ShoppingListItemType;
  onToggle: (itemId: number) => Promise<void> | void;
  onDelete: (itemId: number) => Promise<void> | void;
}

export function ShoppingListItem({
  item,
  onToggle,
  onDelete,
}: ShoppingListItemProps) {
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      await onToggle(item.id);
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(item.id);
    } catch {
      setIsDeleting(false);
    }
  };

  const itemQuantity =
    typeof item.quantity === "string"
      ? parseFloat(item.quantity)
      : item.quantity;

  const formatQuantityDisplay = () => {
    if (itemQuantity <= 0) return null;
    if (item.unit) {
      return `${item.quantity}${item.unit}`;
    }
    return `${item.quantity}x`;
  };

  const quantityDisplay = formatQuantityDisplay();

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-2 rounded-lg border border-gray-200",
        "hover:bg-gray-50 transition-colors",
        item.checked && "bg-gray-50",
        isDeleting && "opacity-50 pointer-events-none"
      )}
    >
      <ControlledCheckbox
        checked={item.checked}
        onChange={handleToggle}
        disabled={isToggling}
        className="h-[30px] w-[30px] shrink-0 cursor-pointer"
        aria-label={`Mark ${item.name} as ${
          item.checked ? "unchecked" : "checked"
        }`}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {quantityDisplay && (
            <span
              className={cn(
                "text-lg font-medium text-gray-500",
                item.checked && "line-through"
              )}
            >
              {quantityDisplay}
            </span>
          )}
          <span
            className={cn(
              "text-lg font-medium text-gray-900",
              item.checked && "line-through text-gray-500"
            )}
          >
            {item.name}
          </span>
        </div>

        {item.notes && (
          <div className="mt-1 text-xs text-gray-500">
            <span className="truncate">{item.notes}</span>
          </div>
        )}
      </div>

      <IconButton
        variant="danger"
        size="sm"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label={`Delete ${item.name}`}
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
    </div>
  );
}
