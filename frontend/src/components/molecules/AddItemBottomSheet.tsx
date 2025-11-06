import { FormProvider, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { quickAddItemSchema, type QuickAddItemFormData } from "@/lib/schemas";
import BottomSheet from "@/components/atoms/BottomSheet";
import { Input } from "@/components/atoms/Input";
import { Button } from "@/components/atoms/Button";
import type { BadgeVariant } from "@/components/atoms/Badge";

export interface Category {
  slug: BadgeVariant;
  name: string;
}

interface AddItemBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, category?: BadgeVariant) => Promise<void>;
  categories?: Category[];
}

export default function AddItemBottomSheet({
  isOpen,
  onClose,
  onAdd,
  categories = [
    { slug: "produce", name: "Produce" },
    { slug: "dairy", name: "Dairy" },
    { slug: "meat", name: "Meat" },
    { slug: "bakery", name: "Bakery" },
    { slug: "pantry", name: "Pantry" },
    { slug: "frozen", name: "Frozen" },
    { slug: "beverages", name: "Beverages" },
    { slug: "household", name: "Household" },
    { slug: "other", name: "Other" },
    { slug: "default", name: "Uncategorized" },
  ],
}: AddItemBottomSheetProps) {
  const methods = useForm<QuickAddItemFormData>({
    resolver: zodResolver(quickAddItemSchema),
    defaultValues: {
      name: "",
      category: "",
    },
  });

  const onSubmit = async (data: QuickAddItemFormData) => {
    const category = data.category ? data.category : undefined;
    await onAdd(data.name.trim(), category as BadgeVariant | undefined);
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
