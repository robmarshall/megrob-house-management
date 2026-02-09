import { XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

interface IngredientInputProps {
  index: number;
  value: {
    name: string;
    quantity?: number | string;
    unit?: string;
    notes?: string;
  };
  onChange: (value: {
    name: string;
    quantity?: number | string;
    unit?: string;
    notes?: string;
  }) => void;
  onRemove: () => void;
  error?: string;
  disabled?: boolean;
}

const COMMON_UNITS = [
  "",
  "cups",
  "tbsp",
  "tsp",
  "oz",
  "lb",
  "g",
  "kg",
  "ml",
  "L",
  "pieces",
  "cloves",
  "slices",
  "pinch",
];

export function IngredientInput({
  index,
  value,
  onChange,
  onRemove,
  error,
  disabled = false,
}: IngredientInputProps) {
  const handleChange = (field: string, fieldValue: string | number) => {
    onChange({
      ...value,
      [field]: fieldValue,
    });
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-2 items-start">
        {/* Quantity */}
        <input
          type="number"
          step="0.25"
          min="0"
          placeholder="Qty"
          value={value.quantity || ""}
          onChange={(e) =>
            handleChange(
              "quantity",
              e.target.value ? parseFloat(e.target.value) : ""
            )
          }
          disabled={disabled}
          className={cn(
            "w-20 px-3 py-2 rounded-lg border bg-white text-gray-900",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
            "transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed",
            error ? "border-red-500" : "border-gray-300"
          )}
        />

        {/* Unit */}
        <select
          value={value.unit || ""}
          onChange={(e) => handleChange("unit", e.target.value)}
          disabled={disabled}
          className={cn(
            "w-24 px-3 py-2 rounded-lg border bg-white text-gray-900",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
            "transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed",
            error ? "border-red-500" : "border-gray-300"
          )}
        >
          {COMMON_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit || "Unit"}
            </option>
          ))}
        </select>

        {/* Name */}
        <input
          type="text"
          placeholder="Ingredient name"
          value={value.name}
          onChange={(e) => handleChange("name", e.target.value)}
          disabled={disabled}
          className={cn(
            "flex-1 px-3 py-2 rounded-lg border bg-white text-gray-900",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
            "transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed",
            error ? "border-red-500" : "border-gray-300"
          )}
        />

        {/* Notes (optional) */}
        <input
          type="text"
          placeholder="Notes (optional)"
          value={value.notes || ""}
          onChange={(e) => handleChange("notes", e.target.value)}
          disabled={disabled}
          className={cn(
            "w-40 px-3 py-2 rounded-lg border bg-white text-gray-900 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
            "transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed",
            "border-gray-300"
          )}
        />

        {/* Remove button */}
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className={cn(
            "p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50",
            "transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          aria-label={`Remove ingredient ${index + 1}`}
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
