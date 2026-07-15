import { describe, it, expect } from 'vitest';
import { useEffect, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import { Checkbox } from './Checkbox';

interface HarnessProps {
  fieldName: string;
  errorMessage?: string;
  children: ReactNode;
}

function Harness({ fieldName, errorMessage, children }: HarnessProps) {
  const methods = useForm();

  useEffect(() => {
    if (errorMessage) {
      methods.setError(fieldName, { message: errorMessage });
    }
  }, [errorMessage, fieldName, methods]);

  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe('Checkbox accessibility wiring', () => {
  it('links the error message to the checkbox via aria-describedby', () => {
    render(
      <Harness fieldName="terms" errorMessage="You must agree">
        <Checkbox id="terms" name="terms" label="I agree" />
      </Harness>
    );

    const checkbox = screen.getByLabelText('I agree');
    const describedBy = checkbox.getAttribute('aria-describedby');

    expect(describedBy).toBeTruthy();
    expect(describedBy).toContain('terms-error');

    const errorEl = document.getElementById('terms-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl).toHaveTextContent('You must agree');
    expect(errorEl).toHaveAttribute('role', 'alert');
  });

  it('omits aria-describedby when there is no description or error', () => {
    render(
      <Harness fieldName="terms">
        <Checkbox id="terms" name="terms" label="I agree" />
      </Harness>
    );

    const checkbox = screen.getByLabelText('I agree');
    expect(checkbox).not.toHaveAttribute('aria-describedby');
  });
});
