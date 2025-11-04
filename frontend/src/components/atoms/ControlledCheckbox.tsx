import { cn } from "@/lib/utils";

interface ControlledCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label": string;
  label?: string;
  id?: string;
}

/**
 * Controlled checkbox component for non-form usage.
 * For use in forms with React Hook Form, use the Checkbox component instead.
 *
 * @example
 * ```tsx
 * const [checked, setChecked] = useState(false)
 * <ControlledCheckbox
 *   checked={checked}
 *   onChange={setChecked}
 *   aria-label="Mark item as complete"
 * />
 * ```
 */
export function ControlledCheckbox({
  checked,
  onChange,
  disabled = false,
  className,
  "aria-label": ariaLabel,
  label,
  id,
}: ControlledCheckboxProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  const inputClasses = cn(
    "rounded border border-gray-300 text-primary-600 focus:ring-primary-600",
    disabled && "opacity-50",
    className
  );

  const containerClasses = cn(
    "relative flex items-center p-[9px] -m-[9px]",
    disabled && "opacity-50"
  );

  return (
    <div className={containerClasses}>
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        aria-label={ariaLabel}
        className={inputClasses}
        id={id}
      />
      {label && (
        <label
          htmlFor={id}
          className="ml-3 block text-sm font-medium leading-6 text-gray-900"
        >
          {label}
        </label>
      )}
    </div>
  );
}
