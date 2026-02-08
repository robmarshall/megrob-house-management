import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Label</Badge>);
    expect(screen.getByText('Label')).toBeInTheDocument();
  });

  it('applies default variant styling', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge.className).toContain('bg-gray-100');
  });

  it('applies info variant', () => {
    render(<Badge variant="info">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge.className).toContain('bg-blue-100');
  });

  it('applies success variant', () => {
    render(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText('Success');
    expect(badge.className).toContain('bg-green-100');
  });

  it('applies warning variant', () => {
    render(<Badge variant="warning">Warning</Badge>);
    const badge = screen.getByText('Warning');
    expect(badge.className).toContain('bg-amber-100');
  });

  it('applies error variant', () => {
    render(<Badge variant="error">Error</Badge>);
    const badge = screen.getByText('Error');
    expect(badge.className).toContain('bg-red-100');
  });

  it('applies primary variant', () => {
    render(<Badge variant="primary">Primary</Badge>);
    const badge = screen.getByText('Primary');
    expect(badge.className).toContain('bg-primary-100');
  });

  it('applies shopping category variants', () => {
    render(<Badge variant="dairy">Dairy</Badge>);
    expect(screen.getByText('Dairy').className).toContain('bg-blue-100');

    render(<Badge variant="meat">Meat</Badge>);
    expect(screen.getByText('Meat').className).toContain('bg-red-100');

    render(<Badge variant="fruitveg">Fruit & Veg</Badge>);
    expect(screen.getByText('Fruit & Veg').className).toContain('bg-green-100');
  });

  it('accepts custom className', () => {
    render(<Badge className="my-class">Custom</Badge>);
    expect(screen.getByText('Custom').className).toContain('my-class');
  });

  it('renders as an inline-flex span', () => {
    render(<Badge>Span</Badge>);
    const el = screen.getByText('Span');
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toContain('inline-flex');
  });
});
