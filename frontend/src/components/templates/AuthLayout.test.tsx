import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthLayout } from './AuthLayout';

describe('AuthLayout', () => {
  it('shows the Home Management footer and not the placeholder company name', () => {
    render(
      <MemoryRouter>
        <AuthLayout title="Sign In" subtitle="Welcome back">
          <div>Form content</div>
        </AuthLayout>
      </MemoryRouter>
    );

    expect(screen.getByText(/Home Management\. All rights reserved\./)).toBeInTheDocument();
    expect(screen.queryByText(/Your Company/)).not.toBeInTheDocument();
  });

  it('renders the title, subtitle, and children', () => {
    render(
      <MemoryRouter>
        <AuthLayout title="Sign In" subtitle="Welcome back">
          <div>Form content</div>
        </AuthLayout>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByText('Form content')).toBeInTheDocument();
  });
});
