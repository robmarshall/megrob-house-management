import { useState, useEffect } from "react";
import { CheckIcon, HandThumbUpIcon, HandThumbDownIcon } from "@heroicons/react/24/outline";
import { HandThumbUpIcon as HandThumbUpSolid, HandThumbDownIcon as HandThumbDownSolid } from "@heroicons/react/24/solid";
import BottomSheet from "@/components/atoms/BottomSheet";
import { Button } from "@/components/atoms/Button";
import { cn } from "@/lib/utils";

interface AddFeedbackBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (isLike: boolean, note: string) => Promise<void>;
  recipeName: string;
  isLoading?: boolean;
}

/**
 * AddFeedbackBottomSheet
 * Bottom sheet for adding like/dislike feedback with an optional note
 */
export function AddFeedbackBottomSheet({
  isOpen,
  onClose,
  onSubmit,
  recipeName,
  isLoading = false,
}: AddFeedbackBottomSheetProps) {
  const [isLike, setIsLike] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset state when sheet opens
  useEffect(() => {
    if (isOpen) {
      setIsLike(null);
      setNote("");
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    setError(null);

    if (isLike === null) {
      setError("Please select like or dislike");
      return;
    }

    try {
      await onSubmit(isLike, note.trim());
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      if (err && typeof err === "object" && "message" in err) {
        setError((err as { message: string }).message);
      } else {
        setError("Failed to add feedback. Please try again.");
      }
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Feedback"
    >
      <div className="flex flex-col gap-4">
        {success ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckIcon className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-lg font-medium text-gray-900">
              Feedback added!
            </p>
            <p className="text-sm text-gray-500">
              Your feedback for "{recipeName}" has been saved
            </p>
          </div>
        ) : (
          <>
            {/* Like/Dislike selection */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                How was this recipe?
              </h3>
              <div className="flex gap-4 justify-center">
                {/* Like button */}
                <button
                  type="button"
                  onClick={() => setIsLike(true)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    isLike === true
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-200 hover:border-green-300 hover:bg-green-50 text-gray-500"
                  )}
                >
                  {isLike === true ? (
                    <HandThumbUpSolid className="w-10 h-10" />
                  ) : (
                    <HandThumbUpIcon className="w-10 h-10" />
                  )}
                  <span className="font-medium">Liked it</span>
                </button>

                {/* Dislike button */}
                <button
                  type="button"
                  onClick={() => setIsLike(false)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    isLike === false
                      ? "border-red-500 bg-red-50 text-red-700"
                      : "border-gray-200 hover:border-red-300 hover:bg-red-50 text-gray-500"
                  )}
                >
                  {isLike === false ? (
                    <HandThumbDownSolid className="w-10 h-10" />
                  ) : (
                    <HandThumbDownIcon className="w-10 h-10" />
                  )}
                  <span className="font-medium">Needs work</span>
                </button>
              </div>
            </div>

            {/* Note input */}
            <div>
              <label
                htmlFor="feedback-note"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Notes (optional)
              </label>
              <textarea
                id="feedback-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  isLike === true
                    ? "What made it great? Any tips for next time?"
                    : isLike === false
                    ? "What could be improved? Any adjustments to try?"
                    : "Add any notes about your experience..."
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                Your notes help track improvements over time
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmit}
                disabled={isLike === null || isLoading}
                isLoading={isLoading}
                className="flex-1"
              >
                Add Feedback
              </Button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
