import { forwardRef, type Ref } from "react";
import { useFormContext, type RegisterOptions } from "react-hook-form";
import { InputWrapper } from "@/components/molecules/InputWrapper";
import { cn } from "@/lib/utils";

export interface SelectProps {
  children: React.ReactNode;
  description?: string;
  disabled?: boolean;
  hideLabel?: boolean;
  id?: string;
  label?: string;
  name: string;
  required?: boolean | string;
  rules?: Pick<RegisterOptions, "validate" | "required">;
  selectProps?: React.SelectHTMLAttributes<HTMLSelectElement>;
}

/**
 * This component is a React Hook Form wrapper for the select element.
 * It uses useFormContext to automatically register with the form and mirrors
 * the Input atom's label, error display, and aria wiring. Pass the `<option>`
 * elements as children.
 */
export const Select = forwardRef(function Select(
  {
    children,
    description = "",
    disabled = false,
    hideLabel = false,
    id = "",
    label = "",
    name,
    required = false,
    rules = {},
    selectProps = {},
    ...rest
  }: SelectProps,
  ref: Ref<HTMLSelectElement>
) {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  const error = errors[name];
  const errorMessage = error?.message as string | undefined;

  const requiredMessage =
    typeof required === "string"
      ? required
      : required
      ? "This field is required"
      : false;

  const { ref: rhfRef, ...rhfRest } = register(name, {
    required: requiredMessage,
    // An empty-string option is the "no selection" placeholder, so store it as
    // undefined. This keeps optional enum fields valid when left unset instead
    // of submitting "" (which would fail a z.enum().optional() schema).
    setValueAs: (value) => (value === "" ? undefined : value),
    ...rules,
  });

  const baseClasses = cn(
    "block w-full rounded-md border-0 px-3 py-2 mt-2",
    "text-gray-900 ring-1 ",
    "focus:ring-2 focus:ring-inset focus:ring-primary-600",
    "sm:text-sm sm:leading-6",
    "disabled:bg-gray-100 disabled:cursor-not-allowed",
    errorMessage
      ? "text-red-900 ring-red-300 focus:ring-red-500"
      : "ring-gray-300"
  );

  const selectId = id || name;

  const describedBy =
    [
      description ? `${selectId}-description` : null,
      errorMessage ? `${selectId}-error` : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <InputWrapper
      description={description}
      disabled={disabled}
      error={errorMessage}
      hideLabel={hideLabel}
      label={label}
      id={selectId}
      required={Boolean(required)}
    >
      <select
        {...(describedBy && { "aria-describedby": describedBy })}
        aria-invalid={Boolean(errorMessage)}
        aria-required={Boolean(required)}
        id={selectId}
        className={baseClasses}
        disabled={disabled}
        {...selectProps}
        {...rhfRest}
        {...rest}
        ref={(e) => {
          rhfRef(e);
          if (ref && e) {
            (ref as React.MutableRefObject<HTMLSelectElement>).current = e;
          }
        }}
      >
        {children}
      </select>
    </InputWrapper>
  );
});
