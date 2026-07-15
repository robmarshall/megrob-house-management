import { describe, it, expect } from 'vitest';
import { useEffect, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import { Input } from './Input';

interface HarnessProps {
  fieldName: string;
  errorMessage?: string;
  children: ReactNode;
}

/**
 * Wraps children in a FormProvider and, when an errorMessage is supplied,
 * forces a validation error on the given field so error wiring can be asserted.
 */
function Harness({ fieldName, errorMessage, children }: HarnessProps) {
  const methods = useForm();

  useEffect(() => {
    if (errorMessage) {
      methods.setError(fieldName, { message: errorMessage });
    }
  }, [errorMessage, fieldName, methods]);

  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe('Input accessibility wiring', () => {
  it('links the error message to the input via aria-describedby', () => {
    render(
      <Harness fieldName="email" errorMessage="Email is required">
        <Input name="email" label="Email" />
      </Harness>
    );

    const input = screen.getByLabelText('Email');
    const describedBy = input.getAttribute('aria-describedby');

    expect(describedBy).toBeTruthy();
    expect(describedBy).toContain('email-error');

    const errorEl = document.getElementById('email-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl).toHaveTextContent('Email is required');
    expect(errorEl).toHaveAttribute('role', 'alert');
  });

  it('references both description and error ids when both are present', () => {
    render(
      <Harness fieldName="email" errorMessage="Email is required">
        <Input name="email" label="Email" description="Your work email" />
      </Harness>
    );

    const input = screen.getByLabelText('Email');
    const describedBy = input.getAttribute('aria-describedby') ?? '';

    expect(describedBy.split(' ')).toEqual(
      expect.arrayContaining(['email-description', 'email-error'])
    );
  });

  it('omits aria-describedby when there is no description or error', () => {
    render(
      <Harness fieldName="email">
        <Input name="email" label="Email" />
      </Harness>
    );

    const input = screen.getByLabelText('Email');
    expect(input).not.toHaveAttribute('aria-describedby');
  });
});
