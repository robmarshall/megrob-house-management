import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card } from './Card';

describe('Card', () => {
  it('renders a plain, non-interactive div with no role or tabindex by default', () => {
    const { container } = render(<Card>Plain content</Card>);
    const card = container.firstChild as HTMLElement;

    expect(card.tagName).toBe('DIV');
    expect(card).toHaveTextContent('Plain content');
    // Not exposed as a button and not keyboard-focusable.
    expect(card.getAttribute('role')).toBeNull();
    expect(card.getAttribute('tabindex')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders as an accessible button when interactive', () => {
    render(
      <Card interactive onClick={() => {}}>
        Interactive
      </Card>
    );
    const card = screen.getByRole('button');
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute('tabindex', '0');
  });

  it('calls onClick when clicked (interactive)', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Card interactive onClick={onClick}>
        Click me
      </Card>
    );
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('activates onClick when Enter is pressed while focused', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Card interactive onClick={onClick}>
        Keyboard
      </Card>
    );
    const card = screen.getByRole('button');
    card.focus();
    expect(card).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('activates onClick when Space is pressed while focused', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Card interactive onClick={onClick}>
        Keyboard
      </Card>
    );
    const card = screen.getByRole('button');
    card.focus();
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not add keyboard handling to non-interactive cards', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { container } = render(<Card onClick={onClick}>Not interactive</Card>);
    const card = container.firstChild as HTMLElement;
    card.focus();
    // A plain div is not focusable, so keyboard activation must not fire onClick.
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('still invokes a caller-provided onKeyDown', async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    const onClick = vi.fn();
    render(
      <Card interactive onClick={onClick} onKeyDown={onKeyDown}>
        Keyboard
      </Card>
    );
    const card = screen.getByRole('button');
    card.focus();
    await user.keyboard('{Enter}');
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    // Caller handler did not preventDefault, so onClick still fires on Enter.
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('respects a caller-provided role override when interactive', () => {
    render(
      <Card interactive role="link" onClick={() => {}}>
        Linkish
      </Card>
    );
    expect(screen.getByRole('link')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
