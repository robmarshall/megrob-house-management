import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/atoms/Input";
import { Button } from "@/components/atoms/Button";
import { quickAddItemSchema, type QuickAddItemFormData } from "@/lib/schemas";

interface AddItemInputProps {
  onAdd: (name: string, category?: string) => Promise<void> | void;
  placeholder?: string;
  categories?: string[];
}

export function AddItemInput({
  onAdd,
  placeholder = "Add item...",
  categories = [
    "Produce",
    "Dairy",
    "Meat",
    "Bakery",
    "Pantry",
    "Frozen",
    "Beverages",
    "Household",
    "Other",
    "Uncategorized",
  ],
}: AddItemInputProps) {
  const methods = useForm<QuickAddItemFormData>({
    resolver: zodResolver(quickAddItemSchema),
    defaultValues: {
      name: "",
      category: "",
    },
  });

  const onSubmit = async (data: QuickAddItemFormData) => {
    await onAdd(data.name.trim(), data.category || undefined);
    methods.reset();
  };

  const isSubmitting = methods.formState.isSubmitting;
  const nameValue = methods.watch("name");

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        className="flex gap-2 items-start"
      >
        <div className="flex-1">
          <Input
            name="name"
            placeholder={placeholder}
            disabled={isSubmitting}
            hideLabel
          />
        </div>

        <Controller
          name="category"
          control={methods.control}
          render={({ field }) => (
            <select
              {...field}
              disabled={isSubmitting}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">Category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
        />

        <Button
          type="submit"
          disabled={!nameValue?.trim() || isSubmitting}
          isLoading={isSubmitting}
        >
          Add
        </Button>
      </form>
    </FormProvider>
  );
}
