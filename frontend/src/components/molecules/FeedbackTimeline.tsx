import { HandThumbUpIcon, HandThumbDownIcon, TrashIcon } from "@heroicons/react/24/solid";
import { Card } from "@/components/atoms/Card";
import type { RecipeFeedback } from "@/types/recipe";
import { cn } from "@/lib/utils";

interface FeedbackTimelineProps {
  entries: RecipeFeedback[];
  currentUserId?: string;
  onDelete?: (feedbackId: number) => Promise<void>;
  isDeleting?: boolean;
  className?: string;
}

/**
 * Format a date string to a readable format
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Today
  if (diffDays === 0) {
    return "Today";
  }

  // Yesterday
  if (diffDays === 1) {
    return "Yesterday";
  }

  // Within last week
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  // Format as date
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * FeedbackTimeline
 * Displays a chronological list of feedback entries for a recipe
 */
export function FeedbackTimeline({
  entries,
  currentUserId,
  onDelete,
  isDeleting = false,
  className,
}: FeedbackTimelineProps) {
  if (entries.length === 0) {
    return (
      <Card className={className}>
        <div className="p-6 text-center">
          <div className="text-gray-400 mb-2">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-gray-900 mb-1">
            No feedback yet
          </h3>
          <p className="text-sm text-gray-500">
            Be the first to share your experience with this recipe
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Feedback History
        </h2>
        <div className="space-y-4">
          {entries.map((entry) => {
            const isOwnEntry = currentUserId === entry.userId;

            return (
              <div
                key={entry.id}
                className={cn(
                  "relative pl-8 pb-4 border-b border-gray-100 last:border-0 last:pb-0"
                )}
              >
                {/* Timeline dot */}
                <div
                  className={cn(
                    "absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center",
                    entry.isLike ? "bg-green-100" : "bg-red-100"
                  )}
                >
                  {entry.isLike ? (
                    <HandThumbUpIcon className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <HandThumbDownIcon className="w-3.5 h-3.5 text-red-600" />
                  )}
                </div>

                {/* Content */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-gray-900">
                        {entry.userName || "Unknown User"}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-500">
                        {formatDate(entry.createdAt)}
                      </span>
                    </div>

                    {/* Note */}
                    {entry.note && (
                      <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">
                        "{entry.note}"
                      </p>
                    )}

                    {/* No note indicator */}
                    {!entry.note && (
                      <p className="mt-1 text-sm text-gray-400 italic">
                        {entry.isLike ? "Gave a thumbs up" : "Gave a thumbs down"}
                      </p>
                    )}
                  </div>

                  {/* Delete button for own entries */}
                  {isOwnEntry && onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(entry.id)}
                      disabled={isDeleting}
                      className={cn(
                        "p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors",
                        isDeleting && "opacity-50 cursor-not-allowed"
                      )}
                      aria-label="Delete feedback"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
