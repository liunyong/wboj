import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SessionExpiryModal from './SessionExpiryModal.jsx';

afterEach(() => {
  cleanup();
});

describe('SessionExpiryModal', () => {
  it('renders countdown and handles actions', async () => {
    const user = userEvent.setup();
    const handleExtend = vi.fn();
    const handleLogout = vi.fn();

    render(
      <SessionExpiryModal
        open
        msRemaining={125000}
        onExtend={handleExtend}
        onLogout={handleLogout}
      />
    );

    expect(screen.getByText('02:05')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /session expiring soon/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /extend/i }));
    expect(handleExtend).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /log out/i }));
    expect(handleLogout).toHaveBeenCalledTimes(1);
  });

  it('hides when open is false', () => {
    const { rerender } = render(
      <SessionExpiryModal open={false} msRemaining={1000} onExtend={() => {}} onLogout={() => {}} />
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    rerender(
      <SessionExpiryModal open msRemaining={1000} onExtend={() => {}} onLogout={() => {}} />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
