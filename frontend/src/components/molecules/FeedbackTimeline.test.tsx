import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackTimeline } from './FeedbackTimeline';
import type { RecipeFeedback } from '@/types/recipe';

const currentUserId = 'user-1';

const ownEntry: RecipeFeedback = {
  id: 42,
  recipeId: 1,
  userId: currentUserId,
  userName: 'Alice',
  isLike: true,
  note: 'Loved this recipe',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('FeedbackTimeline', () => {
  it('opens the confirm delete flow without calling onDelete immediately', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <FeedbackTimeline
        entries={[ownEntry]}
        currentUserId={currentUserId}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByLabelText('Delete feedback'));

    expect(
      await screen.findByText(`Delete "${ownEntry.note}"?`)
    ).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('calls onDelete with the entry id when confirming in the sheet', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <FeedbackTimeline
        entries={[ownEntry]}
        currentUserId={currentUserId}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByLabelText('Delete feedback'));
    await screen.findByText(`Delete "${ownEntry.note}"?`);
    await user.click(screen.getByRole('button', { name: 'Yes, Delete' }));
    await user.click(
      screen.getByRole('button', { name: 'Permanently Delete' })
    );

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(ownEntry.id);
  });
});
