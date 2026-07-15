import { describe, it, expect } from 'vitest';
import { useEffect, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import { Select } from './Select';

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

describe('Select', () => {
  it('renders a select with its label and options', () => {
    render(
      <Harness fieldName="difficulty">
        <Select name="difficulty" label="Pick">
          <option value="">Select difficulty</option>
          <option value="easy">Easy</option>
          <option value="hard">Hard</option>
        </Select>
      </Harness>
    );

    const select = screen.getByLabelText('Pick');
    expect(select.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Easy' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Hard' })).toBeInTheDocument();
  });

  it('links the error message to the select via aria-describedby', () => {
    render(
      <Harness fieldName="difficulty" errorMessage="Required">
        <Select name="difficulty" label="Pick">
          <option value="">Select difficulty</option>
          <option value="easy">Easy</option>
        </Select>
      </Harness>
    );

    const select = screen.getByLabelText('Pick');
    expect(select).toHaveAttribute('aria-invalid', 'true');

    const describedBy = select.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(describedBy).toContain('difficulty-error');

    const errorEl = document.getElementById('difficulty-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl).toHaveTextContent('Required');
    expect(errorEl).toHaveAttribute('role', 'alert');
  });

  it('omits aria-describedby when there is no description or error', () => {
    render(
      <Harness fieldName="difficulty">
        <Select name="difficulty" label="Pick">
          <option value="">Select difficulty</option>
        </Select>
      </Harness>
    );

    const select = screen.getByLabelText('Pick');
    expect(select).not.toHaveAttribute('aria-describedby');
    expect(select).toHaveAttribute('aria-invalid', 'false');
  });
});
