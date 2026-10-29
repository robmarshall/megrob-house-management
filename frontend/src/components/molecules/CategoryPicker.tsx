import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/atoms/Button";
import {
  MEAL_TYPES,
  DIETARY_OPTIONS,
  ALLERGENS,
  SUGGESTED_TAGS,
  categoryLabels,
  type RecipeCategoryType,
} from "@/types/recipe";

interface CategoryPickerProps {
  selectedCategories: Array<{ type: RecipeCategoryType; value: string }>;
  onChange: (categories: Array<{ type: RecipeCategoryType; value: string }>) => void;
  disabled?: boolean;
  /** Tags already used on other recipes, offered as one-tap options. */
  availableTags?: string[];
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

interface TagSectionProps {
  selectedTags: string[];
  availableTags: string[];
  onToggle: (value: string) => void;
  onAdd: (value: string) => void;
  disabled?: boolean;
}

/** Union of tag spellings, first occurrence wins, compared case-insensitively. */
function uniqueTags(...lists: ReadonlyArray<readonly string[]>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of lists.flat()) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }
  return result;
}

function TagSection({
  selectedTags,
  availableTags,
  onToggle,
  onAdd,
  disabled,
}: TagSectionProps) {
  const [draft, setDraft] = useState("");
  const options = uniqueTags(availableTags, SUGGESTED_TAGS, selectedTags);
  const isSelected = (value: string) =>
    selectedTags.some((t) => t.toLowerCase() === value.toLowerCase());

  const addDraft = () => {
    // Commas would split the tag in the filter query string.
    const value = draft.replace(/[,\s]+/g, " ").trim();
    if (!value) return;
    // Reuse an existing spelling so "camping" doesn't sit beside "Camping".
    onAdd(options.find((t) => t.toLowerCase() === value.toLowerCase()) ?? value);
    setDraft("");
  };

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-2">Tags</h4>
      <div className="flex flex-wrap gap-2">
        {options.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            disabled={disabled}
            aria-pressed={isSelected(tag)}
            className={cn(
              "px-3 py-1.5 rounded-full border text-sm font-medium transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isSelected(tag)
                ? "bg-blue-100 text-blue-800 border-blue-300"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            )}
          >
            {tag}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter adds the tag instead of submitting the recipe form.
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
          disabled={disabled}
          maxLength={100}
          placeholder="Add a tag, e.g. Camping"
          aria-label="New tag"
          className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={addDraft}
          disabled={disabled || !draft.trim()}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

export function CategoryPicker({
  selectedCategories,
  onChange,
  disabled = false,
  availableTags = [],
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

  const selectedTags = selectedCategories
    .filter((c) => c.type === "tag")
    .map((c) => c.value);

  const toggleTag = (value: string) => {
    const lower = value.toLowerCase();
    if (selectedTags.some((t) => t.toLowerCase() === lower)) {
      onChange(
        selectedCategories.filter(
          (c) => !(c.type === "tag" && c.value.toLowerCase() === lower)
        )
      );
    } else {
      onChange([...selectedCategories, { type: "tag", value }]);
    }
  };

  const addTag = (value: string) => {
    if (selectedTags.some((t) => t.toLowerCase() === value.toLowerCase())) return;
    onChange([...selectedCategories, { type: "tag", value }]);
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

      <TagSection
        selectedTags={selectedTags}
        availableTags={availableTags}
        onToggle={toggleTag}
        onAdd={addTag}
        disabled={disabled}
      />
    </div>
  );
}
