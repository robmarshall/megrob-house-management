import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  /** Show page numbers (default: true) */
  showPageNumbers?: boolean;
  /** Max number of page buttons to show (default: 5) */
  maxPageButtons?: number;
}

/**
 * Pagination component for navigating through pages
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
  showPageNumbers = true,
  maxPageButtons = 5,
}: PaginationProps) {
  // Don't render if only one page
  if (totalPages <= 1) return null;

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const handlePrev = () => {
    if (canGoPrev) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      onPageChange(currentPage + 1);
    }
  };

  // Calculate which page numbers to show
  const getPageNumbers = (): (number | "ellipsis")[] => {
    if (totalPages <= maxPageButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | "ellipsis")[] = [];
    const halfVisible = Math.floor((maxPageButtons - 2) / 2);

    // Always show first page
    pages.push(1);

    // Calculate start and end of visible range
    let start = Math.max(2, currentPage - halfVisible);
    let end = Math.min(totalPages - 1, currentPage + halfVisible);

    // Adjust if we're near the beginning
    if (currentPage <= halfVisible + 1) {
      end = Math.min(totalPages - 1, maxPageButtons - 1);
    }

    // Adjust if we're near the end
    if (currentPage >= totalPages - halfVisible) {
      start = Math.max(2, totalPages - maxPageButtons + 2);
    }

    // Add ellipsis and visible pages
    if (start > 2) {
      pages.push("ellipsis");
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages - 1) {
      pages.push("ellipsis");
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <nav
      className={cn("flex items-center justify-center gap-1", className)}
      aria-label="Pagination"
    >
      {/* Previous button */}
      <button
        type="button"
        onClick={handlePrev}
        disabled={!canGoPrev}
        className={cn(
          "flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
          canGoPrev
            ? "text-gray-700 hover:bg-gray-100"
            : "text-gray-300 cursor-not-allowed"
        )}
        aria-label="Previous page"
      >
        <ChevronLeftIcon className="w-5 h-5" />
      </button>

      {/* Page numbers */}
      {showPageNumbers && (
        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, index) =>
            page === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="px-2 text-gray-400"
                aria-hidden="true"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-lg text-sm font-medium transition-colors",
                  page === currentPage
                    ? "bg-primary-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                )}
                aria-label={`Page ${page}`}
                aria-current={page === currentPage ? "page" : undefined}
              >
                {page}
              </button>
            )
          )}
        </div>
      )}

      {/* Simple page indicator if not showing numbers */}
      {!showPageNumbers && (
        <span className="px-3 text-sm text-gray-600">
          Page {currentPage} of {totalPages}
        </span>
      )}

      {/* Next button */}
      <button
        type="button"
        onClick={handleNext}
        disabled={!canGoNext}
        className={cn(
          "flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
          canGoNext
            ? "text-gray-700 hover:bg-gray-100"
            : "text-gray-300 cursor-not-allowed"
        )}
        aria-label="Next page"
      >
        <ChevronRightIcon className="w-5 h-5" />
      </button>
    </nav>
  );
}
