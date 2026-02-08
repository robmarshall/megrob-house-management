import { MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

interface ServingScalerProps {
  originalServings: number;
  currentServings: number;
  onServingsChange: (servings: number) => void;
  className?: string;
  min?: number;
  max?: number;
}

/**
 * ServingScaler component for adjusting recipe serving sizes
 *
 * Displays the original serving count and allows incrementing/decrementing
 * the current servings with +/- buttons.
 */
export function ServingScaler({
  originalServings,
  currentServings,
  onServingsChange,
  className,
  min = 1,
  max = 50,
}: ServingScalerProps) {
  const isScaled = currentServings !== originalServings;

  const handleDecrement = () => {
    if (currentServings > min) {
      onServingsChange(currentServings - 1);
    }
  };

  const handleIncrement = () => {
    if (currentServings < max) {
      onServingsChange(currentServings + 1);
    }
  };

  const handleReset = () => {
    onServingsChange(originalServings);
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={currentServings <= min}
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-full",
            "bg-gray-100 hover:bg-gray-200 transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          aria-label="Decrease servings"
        >
          <MinusIcon className="w-4 h-4" />
        </button>

        <span className="min-w-[3rem] text-center font-semibold">
          {currentServings}
        </span>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={currentServings >= max}
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-full",
            "bg-gray-100 hover:bg-gray-200 transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          aria-label="Increase servings"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      <span className="text-sm text-gray-500">servings</span>

      {isScaled && (
        <>
          <span className="text-xs text-gray-400">
            (originally {originalServings})
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-primary-600 hover:text-primary-700 underline"
          >
            Reset
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Scale a quantity by a multiplier and format nicely
 */
export function scaleQuantity(quantity: string | null | undefined, multiplier: number): string {
  if (!quantity) return "";

  const num = parseFloat(quantity);
  if (isNaN(num)) return quantity;

  const scaled = num * multiplier;

  // Format nicely - avoid ugly decimals
  if (Number.isInteger(scaled)) {
    return scaled.toString();
  }

  // Common fractions
  const fractions: [number, string][] = [
    [0.25, "1/4"],
    [0.5, "1/2"],
    [0.75, "3/4"],
    [0.333, "1/3"],
    [0.667, "2/3"],
    [0.125, "1/8"],
    [0.375, "3/8"],
    [0.625, "5/8"],
    [0.875, "7/8"],
  ];

  // Check for whole number + fraction
  const wholePart = Math.floor(scaled);
  const decimalPart = scaled - wholePart;

  for (const [value, fraction] of fractions) {
    if (Math.abs(decimalPart - value) < 0.01) {
      if (wholePart > 0) {
        return `${wholePart} ${fraction}`;
      }
      return fraction;
    }
  }

  // Default to 2 decimal places, trimmed
  return scaled.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Format a scaled ingredient for display
 */
export function formatScaledIngredient(
  ingredient: { quantity?: string | null; unit?: string | null; name: string; notes?: string | null },
  multiplier: number
): string {
  const parts: string[] = [];

  if (ingredient.quantity) {
    parts.push(scaleQuantity(ingredient.quantity, multiplier));
  }

  if (ingredient.unit) {
    parts.push(ingredient.unit);
  }

  parts.push(ingredient.name);

  if (ingredient.notes) {
    parts.push(`(${ingredient.notes})`);
  }

  return parts.join(" ");
}
