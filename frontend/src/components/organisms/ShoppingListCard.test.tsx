import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShoppingListCard } from './ShoppingListCard';
import type { ShoppingList } from '@/types/shoppingList';

const list: ShoppingList = {
  id: 1,
  name: 'Groceries',
  description: 'Weekly shopping',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

describe('ShoppingListCard', () => {
  it('renders the delete control visibly, not hidden behind hover', () => {
    render(<ShoppingListCard list={list} onClick={() => {}} onDelete={() => {}} />);

    const deleteButton = screen.getByLabelText(`Delete ${list.name}`);
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton.className).not.toContain('opacity-0');
    expect(deleteButton.className).not.toContain('group-hover');
  });

  it('does not render a delete control when onDelete is not provided', () => {
    render(<ShoppingListCard list={list} onClick={() => {}} />);
    expect(screen.queryByLabelText(`Delete ${list.name}`)).not.toBeInTheDocument();
  });

  it('opens the confirm delete flow when clicking delete, without calling onDelete immediately', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<ShoppingListCard list={list} onClick={() => {}} onDelete={onDelete} />);

    await user.click(screen.getByLabelText(`Delete ${list.name}`));

    expect(await screen.findByText(`Delete "${list.name}"?`)).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('calls onClick when the card body is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ShoppingListCard list={list} onClick={onClick} onDelete={() => {}} />);

    await user.click(screen.getByText(list.name));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not trigger onClick when the delete button is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ShoppingListCard list={list} onClick={onClick} onDelete={() => {}} />);

    await user.click(screen.getByLabelText(`Delete ${list.name}`));

    expect(onClick).not.toHaveBeenCalled();
  });
});
