import { useEffect, useRef, useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import {
  ChevronDownIcon,
  PhotoIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Input } from "@/components/atoms/Input";
import { Button } from "@/components/atoms/Button";
import { downscaleImage } from "@/lib/imageResize";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** Mirrors the API's upload cap. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface RecipeImageFieldProps {
  disabled?: boolean;
}

function objectUrlFor(file: File | undefined): string | null {
  if (!file) return null;
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return null;
  }
  return URL.createObjectURL(file);
}

function formatKilobytes(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Recipe photo picker for RecipeForm. Writes to two form fields:
 *
 * - `imageFile` (File | undefined): a photo chosen from the device. It is
 *   downscaled in the browser straight away and uploaded by the page after
 *   the recipe itself is saved, so the recipe always exists before its image.
 * - `imageUrl` (string): the existing hotlink/stored URL, editable under the
 *   "use an image URL" disclosure for people who'd rather paste a link.
 *
 * A chosen file takes precedence in the preview; "Remove" clears both.
 */
export function RecipeImageField({ disabled = false }: RecipeImageFieldProps) {
  const { control, setValue } = useFormContext();
  // useWatch (not watch) so this child re-renders on its own subscription
  // rather than relying on the form host re-rendering.
  const imageUrl = (useWatch({ control, name: "imageUrl" }) as string | undefined) || "";
  const imageFile = useWatch({ control, name: "imageFile" }) as File | undefined;

  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [urlPreviewFailed, setUrlPreviewFailed] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Object URL for the pending file; revoked when the file changes or unmounts.
  useEffect(() => {
    const url = objectUrlFor(imageFile);
    setFilePreview(url);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  useEffect(() => {
    setUrlPreviewFailed(false);
  }, [imageUrl]);

  const previewSrc =
    filePreview ?? (imageUrl && !urlPreviewFailed ? imageUrl : null);

  const handleRemove = () => {
    setValue("imageFile", undefined, { shouldDirty: true });
    setValue("imageUrl", "", { shouldDirty: true });
  };

  return (
    <div className="space-y-3">
      <span className="block text-sm font-medium text-gray-700">Photo</span>

      {previewSrc && (
        <div className="relative rounded-lg overflow-hidden border border-gray-200">
          <img
            src={previewSrc}
            alt="Recipe preview"
            className="w-full h-48 object-cover"
            onError={() => {
              if (!filePreview) setUrlPreviewFailed(true);
            }}
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            aria-label="Remove image"
            className={cn(
              "absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-gray-600 shadow",
              "hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-primary-500",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      <Controller
        name="imageFile"
        control={control}
        render={({ field }) => (
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              className="sr-only"
              aria-label="Choose a recipe photo"
              disabled={disabled || isProcessing}
              onChange={async (event) => {
                const picked = event.target.files?.[0];
                // Reset so choosing the same file again still fires onChange.
                event.target.value = "";
                if (!picked) return;

                // An empty type happens for formats the OS doesn't recognise
                // (e.g. HEIC on some platforms); let the server make the call.
                if (picked.type && !ACCEPTED_TYPES.includes(picked.type)) {
                  toast.error("Please choose a JPEG, PNG, WebP or GIF image.");
                  return;
                }

                setIsProcessing(true);
                try {
                  const prepared = await downscaleImage(picked);
                  if (prepared.size > MAX_UPLOAD_BYTES) {
                    toast.error(
                      "That image is too large (max 5MB). Try a smaller photo."
                    );
                    return;
                  }
                  field.onChange(prepared);
                } finally {
                  setIsProcessing(false);
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              isLoading={isProcessing}
            >
              <PhotoIcon className="w-4 h-4 mr-1" />
              {previewSrc ? "Change photo" : "Upload photo"}
            </Button>
            {imageFile && (
              <span className="text-xs text-gray-500">
                {imageFile.name} ({formatKilobytes(imageFile.size)}) uploads when you save
              </span>
            )}
          </div>
        )}
      />

      <p className="text-xs text-gray-500">
        JPEG, PNG, WebP or GIF up to 5MB. Large photos are shrunk before upload.
      </p>

      <Disclosure defaultOpen={Boolean(imageUrl) && !imageFile}>
        <DisclosureButton
          className={cn(
            "flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 rounded",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          disabled={disabled}
        >
          Use an image URL instead
          <ChevronDownIcon className="w-4 h-4" />
        </DisclosureButton>
        <DisclosurePanel className="mt-1">
          <Input
            name="imageUrl"
            label="Image URL"
            type="url"
            placeholder="https://example.com/photo.jpg"
            disabled={disabled}
          />
        </DisclosurePanel>
      </Disclosure>
    </div>
  );
}
