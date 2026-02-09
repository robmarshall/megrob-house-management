import { cn } from "@/lib/utils";
import {
  MEAL_TYPES,
  DIETARY_OPTIONS,
  ALLERGENS,
  categoryLabels,
  type RecipeCategoryType,
} from "@/types/recipe";

interface CategoryPickerProps {
  selectedCategories: Array<{ type: RecipeCategoryType; value: string }>;
  onChange: (categories: Array<{ type: RecipeCategoryType; value: string }>) => void;
  disabled?: boolean;
}

interface CategorySectionProps {
  title: string;
  type: RecipeCategoryType;
  options: readonly string[];
  selectedCategories: Array<{ type: RecipeCategoryType; value: string }>;
  onToggle: (type: RecipeCategoryType, value: string) => void;
  disabled?: boolean;
  variant?: "primary" | "success" | "warning";
}

function CategorySection({
  title,
  type,
  options,
  selectedCategories,
  onToggle,
  disabled,
  variant = "primary",
}: CategorySectionProps) {
  const isSelected = (value: string) =>
    selectedCategories.some((c) => c.type === type && c.value === value);

  const variantClasses = {
    primary: {
      selected: "bg-primary-100 text-primary-800 border-primary-300",
      unselected: "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
    },
    success: {
      selected: "bg-green-100 text-green-800 border-green-300",
      unselected: "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
    },
    warning: {
      selected: "bg-amber-100 text-amber-800 border-amber-300",
      unselected: "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
    },
  };

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-2">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(type, option)}
            disabled={disabled}
            className={cn(
              "px-3 py-1.5 rounded-full border text-sm font-medium transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isSelected(option)
                ? variantClasses[variant].selected
                : variantClasses[variant].unselected
            )}
          >
            {categoryLabels[option] || option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CategoryPicker({
  selectedCategories,
  onChange,
  disabled = false,
}: CategoryPickerProps) {
  const handleToggle = (type: RecipeCategoryType, value: string) => {
    const exists = selectedCategories.some(
      (c) => c.type === type && c.value === value
    );

    if (exists) {
      onChange(
        selectedCategories.filter(
          (c) => !(c.type === type && c.value === value)
        )
      );
    } else {
      onChange([...selectedCategories, { type, value }]);
    }
  };

  return (
    <div className="space-y-4">
      <CategorySection
        title="Meal Type"
        type="meal_type"
        options={MEAL_TYPES}
        selectedCategories={selectedCategories}
        onToggle={handleToggle}
        disabled={disabled}
        variant="primary"
      />

      <CategorySection
        title="Dietary"
        type="dietary"
        options={DIETARY_OPTIONS}
        selectedCategories={selectedCategories}
        onToggle={handleToggle}
        disabled={disabled}
        variant="success"
      />

      <CategorySection
        title="Allergens"
        type="allergen"
        options={ALLERGENS}
        selectedCategories={selectedCategories}
        onToggle={handleToggle}
        disabled={disabled}
        variant="warning"
      />
    </div>
  );
}
