import { forwardRef, type Ref } from "react";
import { useFormContext, type RegisterOptions } from "react-hook-form";
import { InputWrapper } from "@/components/molecules/InputWrapper";
import { cn } from "@/lib/utils";

export interface InputProps {
  autoComplete?: string;
  endAdornment?: React.ReactNode;
  description?: string;
  disabled?: boolean;
  hideLabel?: boolean;
  id?: string;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  label?: string;
  name: string;
  placeholder?: string;
  required?: boolean | string;
  startAdornment?: React.ReactNode;
  type?: string;
  rules?: Pick<
    RegisterOptions,
    | "maxLength"
    | "minLength"
    | "validate"
    | "required"
    | "pattern"
    | "min"
    | "max"
  >;
}

/**
 * This component is a React Hook Form wrapper for the input element.
 * It covers Text, Email, Password, and Number input types.
 * It uses useFormContext to automatically register with the form.
 */
export const Input = forwardRef(function Input(
  {
    endAdornment = null,
    description = "",
    disabled = false,
    hideLabel = false,
    id = "",
    inputProps = {},
    label = "",
    name,
    placeholder = "",
    required = false,
    startAdornment = null,
    type = "text",
    rules = {},
    ...rest
  }: InputProps,
  ref: Ref<HTMLInputElement>
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
    ...rules,
  });

  const baseClasses = cn(
    "block w-full rounded-md border-0 px-3 py-2 mt-2",
    "text-gray-900 ring-1 ",
    "placeholder:text-gray-400",
    "focus:ring-2 focus:ring-inset focus:ring-primary-600",
    "sm:text-sm sm:leading-6",
    errorMessage
      ? "text-red-900 ring-red-300 focus:ring-red-500"
      : "ring-gray-300",
    startAdornment && "pl-10",
    endAdornment && "pr-10"
  );

  const inputId = id || name;

  return (
    <InputWrapper
      description={description}
      disabled={disabled}
      error={errorMessage}
      hideLabel={hideLabel}
      label={label}
      id={inputId}
      required={Boolean(required)}
    >
      <div className="relative mt-2 rounded-md shadow-sm">
        {startAdornment && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-gray-400 sm:text-sm">{startAdornment}</span>
          </div>
        )}
        <input
          {...(description && {
            "aria-describedby": `${inputId}-description`,
          })}
          aria-invalid={Boolean(errorMessage)}
          aria-required={Boolean(required)}
          type={type}
          id={inputId}
          className={baseClasses}
          placeholder={placeholder}
          disabled={disabled}
          {...inputProps}
          {...rhfRest}
          {...rest}
          ref={(e) => {
            rhfRef(e);
            if (ref && e) {
              (ref as React.MutableRefObject<HTMLInputElement>).current = e;
            }
          }}
        />
        {endAdornment && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="text-gray-400 sm:text-sm">{endAdornment}</span>
          </div>
        )}
      </div>
    </InputWrapper>
  );
});
