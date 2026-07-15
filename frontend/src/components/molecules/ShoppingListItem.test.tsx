import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShoppingListItem } from './ShoppingListItem';
import type { ShoppingListItem as ShoppingListItemType } from '@/types/shoppingList';

const item: ShoppingListItemType = {
  id: 1,
  listId: 1,
  name: 'Milk',
  category: null,
  quantity: 1,
  unit: null,
  notes: null,
  checked: false,
  checkedAt: null,
  checkedBy: null,
  position: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

describe('ShoppingListItem', () => {
  it('opens the confirm delete flow when clicking delete, without calling onDelete immediately', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <ShoppingListItem item={item} onToggle={() => {}} onDelete={onDelete} />
    );

    await user.click(screen.getByLabelText(`Delete ${item.name}`));

    expect(await screen.findByText(`Delete "${item.name}"?`)).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('calls onDelete with the item id when confirming in the sheet', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <ShoppingListItem item={item} onToggle={() => {}} onDelete={onDelete} />
    );

    await user.click(screen.getByLabelText(`Delete ${item.name}`));
    await screen.findByText(`Delete "${item.name}"?`);
    await user.click(screen.getByRole('button', { name: 'Yes, Delete' }));
    await user.click(
      screen.getByRole('button', { name: 'Permanently Delete' })
    );

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(item.id);
  });

  it('calls onToggle with the item id when the checkbox is toggled', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <ShoppingListItem item={item} onToggle={onToggle} onDelete={() => {}} />
    );

    await user.click(
      screen.getByLabelText(`Mark ${item.name} as checked`)
    );

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(item.id);
  });
});
