import { FormProvider, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { quickAddItemSchema, type QuickAddItemFormData, type UnitType } from "@/lib/schemas";
import BottomSheet from "@/components/atoms/BottomSheet";
import { Input } from "@/components/atoms/Input";
import { Button } from "@/components/atoms/Button";
import type { BadgeVariant } from "@/components/atoms/Badge";

export interface Unit {
  value: UnitType | '';
  label: string;
}

export interface Category {
  slug: BadgeVariant;
  name: string;
}

interface AddItemBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, category?: BadgeVariant, quantity?: number, unit?: UnitType) => Promise<void>;
  categories?: Category[];
  units?: Unit[];
}

export default function AddItemBottomSheet({
  isOpen,
  onClose,
  onAdd,
  categories = [
    { slug: "fruitveg", name: "Fruit & Veg" },
    { slug: "dairy", name: "Dairy" },
    { slug: "meat", name: "Meat" },
    { slug: "fish", name: "Fish" },
    { slug: "bakery", name: "Bakery" },
    { slug: "pantry", name: "Pantry" },
    { slug: "frozen", name: "Frozen" },
    { slug: "beverages", name: "Beverages" },
    { slug: "household", name: "Household" },
    { slug: "toiletries", name: "Toiletries" },
    { slug: "medicine", name: "Medicine" },
    { slug: "other", name: "Other" },
    { slug: "default", name: "Uncategorized" },
  ],
  units = [
    { value: "", label: "No unit" },
    { value: "g", label: "g (grams)" },
    { value: "kg", label: "kg (kilograms)" },
    { value: "ml", label: "ml (milliliters)" },
    { value: "L", label: "L (liters)" },
    { value: "oz", label: "oz (ounces)" },
    { value: "lb", label: "lb (pounds)" },
    { value: "pcs", label: "pcs (pieces)" },
    { value: "pack", label: "pack" },
    { value: "can", label: "can" },
    { value: "bottle", label: "bottle" },
    { value: "bunch", label: "bunch" },
    { value: "bag", label: "bag" },
  ],
}: AddItemBottomSheetProps) {
  const methods = useForm<QuickAddItemFormData>({
    resolver: zodResolver(quickAddItemSchema),
    defaultValues: {
      name: "",
      category: "",
      quantity: 1,
      unit: "",
    },
  });

  const onSubmit = async (data: QuickAddItemFormData) => {
    const category = data.category ? data.category : undefined;
    const unit = data.unit ? data.unit : undefined;
    const quantity = data.quantity ?? 1;
    await onAdd(data.name.trim(), category as BadgeVariant | undefined, quantity, unit as UnitType | undefined);
    methods.reset();
  };

  const isSubmitting = methods.formState.isSubmitting;
  const nameValue = methods.watch("name");

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add Item">
      <FormProvider {...methods}>
        <form
          onSubmit={methods.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          {/* Item Name Input */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Item Name
            </label>
            <Input
              name="name"
              placeholder="Enter item name..."
              disabled={isSubmitting}
              hideLabel
            />
          </div>

          {/* Quantity and Unit Row */}
          <div className="flex gap-3">
            <div className="w-24">
              <label
                htmlFor="quantity"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Quantity
              </label>
              <Controller
                name="quantity"
                control={methods.control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    id="quantity"
                    min="0.01"
                    step="any"
                    disabled={isSubmitting}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                )}
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="unit"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Unit
              </label>
              <Controller
                name="unit"
                control={methods.control}
                render={({ field }) => (
                  <select
                    {...field}
                    id="unit"
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    {units.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>
          </div>

          {/* Category Select */}
          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Category
            </label>
            <Controller
              name="category"
              control={methods.control}
              render={({ field }) => (
                <select
                  {...field}
                  id="category"
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.slug} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              )}
            />
          </div>

          {/* Add Button */}
          <Button
            type="submit"
            variant="primary"
            disabled={!nameValue?.trim() || isSubmitting}
            isLoading={isSubmitting}
            className="w-full"
          >
            Add Item
          </Button>
        </form>
      </FormProvider>
    </BottomSheet>
  );
}
