import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { importRecipeSchema, type ImportRecipeFormData } from "@/lib/schemas";
import BottomSheet from "@/components/atoms/BottomSheet";
import { Input } from "@/components/atoms/Input";
import { Button } from "@/components/atoms/Button";
import { useRecipeData } from "@/hooks/recipe/useRecipes";

interface ImportRecipeBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportRecipeBottomSheet({
  isOpen,
  onClose,
}: ImportRecipeBottomSheetProps) {
  const navigate = useNavigate();
  const { importFromUrl, isImporting } = useRecipeData();
  const [error, setError] = useState<string | null>(null);

  const methods = useForm<ImportRecipeFormData>({
    resolver: zodResolver(importRecipeSchema),
    defaultValues: {
      url: "",
    },
  });

  const onSubmit = async (data: ImportRecipeFormData) => {
    setError(null);
    try {
      const recipe = await importFromUrl(data.url.trim());
      methods.reset();
      onClose();
      // Navigate to the newly imported recipe
      navigate(`/recipes/${recipe.id}`);
    } catch (err) {
      // Handle API errors
      if (err && typeof err === "object" && "message" in err) {
        setError((err as { message: string }).message);
      } else {
        setError("Failed to import recipe. Please try again.");
      }
    }
  };

  const handleClose = () => {
    setError(null);
    methods.reset();
    onClose();
  };

  const urlValue = methods.watch("url");

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Import Recipe from URL">
      <FormProvider {...methods}>
        <form
          onSubmit={methods.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <div>
            <label
              htmlFor="url"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Recipe URL
            </label>
            <Input
              name="url"
              type="url"
              placeholder="https://example.com/recipe..."
              disabled={isImporting}
              hideLabel
            />
            <p className="mt-1 text-xs text-gray-500">
              Paste a link to a recipe from any website that uses structured recipe data
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {isImporting && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-blue-700">
                Importing recipe... This may take a few seconds.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isImporting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!urlValue?.trim() || isImporting}
              isLoading={isImporting}
              className="flex-1"
            >
              {isImporting ? "Importing..." : "Import Recipe"}
            </Button>
          </div>
        </form>
      </FormProvider>
    </BottomSheet>
  );
}
