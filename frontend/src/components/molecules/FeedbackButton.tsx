import { HandThumbUpIcon, HandThumbDownIcon } from '@heroicons/react/24/outline';
import { HandThumbUpIcon as HandThumbUpSolid, HandThumbDownIcon as HandThumbDownSolid } from '@heroicons/react/24/solid';
import { cn } from '@/lib/utils';

interface FeedbackButtonProps {
  type: 'like' | 'dislike';
  count: number;
  onClick?: () => void;
  isActive?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * FeedbackButton
 * A thumbs up/down button with count badge for recipe feedback
 */
export function FeedbackButton({
  type,
  count,
  onClick,
  isActive = false,
  disabled = false,
  size = 'md',
  className,
}: FeedbackButtonProps) {
  const isLike = type === 'like';

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const countSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  // Determine which icon to use based on type and active state
  const OutlineIcon = isLike ? HandThumbUpIcon : HandThumbDownIcon;
  const SolidIcon = isLike ? HandThumbUpSolid : HandThumbDownSolid;
  const Icon = isActive ? SolidIcon : OutlineIcon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full transition-colors',
        sizeClasses[size],
        // Base styles
        'text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-1',
        // Like active state
        isLike && isActive && 'text-green-600 hover:text-green-700 bg-green-50',
        // Dislike active state
        !isLike && isActive && 'text-red-600 hover:text-red-700 bg-red-50',
        // Hover states (when not active)
        isLike && !isActive && 'hover:bg-green-50 focus:ring-green-500',
        !isLike && !isActive && 'hover:bg-red-50 focus:ring-red-500',
        // Disabled state
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      aria-label={`${isLike ? 'Like' : 'Dislike'} (${count})`}
    >
      <Icon className={iconSizeClasses[size]} />
      <span className={cn('font-medium', countSizeClasses[size])}>{count}</span>
    </button>
  );
}
