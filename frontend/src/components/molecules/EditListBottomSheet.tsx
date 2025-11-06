import { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import BottomSheet from "../atoms/BottomSheet";
import { Input } from "../atoms/Input";
import { Textarea } from "../atoms/Textarea";
import { Button } from "../atoms/Button";
import {
  updateShoppingListSchema,
  type UpdateShoppingListFormData,
} from "../../lib/schemas";

interface EditListBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: (data: UpdateShoppingListFormData) => Promise<void>;
  currentName: string;
  currentDescription?: string | null;
}

export default function EditListBottomSheet({
  isOpen,
  onClose,
  onEdit,
  currentName,
  currentDescription,
}: EditListBottomSheetProps) {
  const methods = useForm<UpdateShoppingListFormData>({
    resolver: zodResolver(updateShoppingListSchema),
    defaultValues: {
      name: currentName,
      description: currentDescription || "",
    },
  });

  const onSubmit = async (data: UpdateShoppingListFormData) => {
    await onEdit({
      name: data.name?.trim(),
      description: data.description?.trim() || undefined,
    });
    onClose();
  };

  const isSubmitting = methods.formState.isSubmitting;

  // Reset form when sheet opens with current values
  useEffect(() => {
    if (isOpen) {
      methods.reset({
        name: currentName,
        description: currentDescription || "",
      });
    }
  }, [isOpen, currentName, currentDescription, methods]);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Edit List">
      <FormProvider {...methods}>
        <form
          onSubmit={methods.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          {/* List Name Input */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              List Name
            </label>
            <Input
              name="name"
              placeholder="Enter list name..."
              disabled={isSubmitting}
              hideLabel
            />
          </div>

          {/* Description Textarea */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description
            </label>
            <Textarea
              name="description"
              placeholder="Enter description (optional)..."
              disabled={isSubmitting}
              hideLabel
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="flex-1"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </FormProvider>
    </BottomSheet>
  );
}
