import { useState } from "react";
import { Switch } from "@headlessui/react";
import { CheckIcon, ClipboardIcon, GlobeAltIcon } from "@heroicons/react/24/outline";
import BottomSheet from "@/components/atoms/BottomSheet";
import { Button } from "@/components/atoms/Button";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

interface ShareRecipeBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  recipeName: string;
  isPublic: boolean;
  publicId: string | null;
  onToggle: (isPublic: boolean) => Promise<void>;
  isLoading?: boolean;
}

/**
 * ShareRecipeBottomSheet
 * Toggle public sharing for a recipe and copy the share link.
 */
export function ShareRecipeBottomSheet({
  isOpen,
  onClose,
  recipeName,
  isPublic,
  publicId,
  onToggle,
  isLoading = false,
}: ShareRecipeBottomSheetProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = publicId
    ? `${window.location.origin}/share/recipes/${publicId}`
    : null;

  const handleToggle = async (next: boolean) => {
    try {
      await onToggle(next);
    } catch {
      // Error toast handled by the mutation hook
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link. Please copy it manually.");
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Share Recipe">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600">
          Anyone with the link can view "{recipeName}" — no account needed.
          Turn sharing off at any time to make the link stop working.
        </p>

        {/* Public toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <GlobeAltIcon
              className={cn(
                "w-6 h-6",
                isPublic ? "text-primary-600" : "text-gray-400"
              )}
            />
            <div>
              <p className="text-sm font-medium text-gray-900">Public link</p>
              <p className="text-xs text-gray-500">
                {isPublic ? "Sharing is on" : "Sharing is off"}
              </p>
            </div>
          </div>
          <Switch
            checked={isPublic}
            onChange={handleToggle}
            disabled={isLoading}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isPublic ? "bg-primary-600" : "bg-gray-300"
            )}
          >
            <span className="sr-only">Toggle public sharing</span>
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                isPublic ? "translate-x-6" : "translate-x-1"
              )}
            />
          </Switch>
        </div>

        {/* Share link + copy */}
        {isPublic && shareUrl && (
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
              aria-label="Public share link"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleCopy}
              disabled={isLoading}
            >
              {copied ? (
                <>
                  <CheckIcon className="w-5 h-5 mr-1 text-green-600" />
                  Copied
                </>
              ) : (
                <>
                  <ClipboardIcon className="w-5 h-5 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
