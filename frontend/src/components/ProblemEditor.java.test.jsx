import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import ProblemEditor from './ProblemEditor.jsx';
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ authFetch: async () => [{ id: 62, name: 'Java' }, { id: 71, name: 'Python' }] }) }));
it('authors Java test groups including empty expected stdout', async () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><ProblemEditor /></MemoryRouter></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('Problem mode'), { target: { value: 'java_class' } });
  fireEvent.change(screen.getByLabelText('Required Java class name'), { target: { value: 'Rectangle' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Java test group' }));
  expect(screen.getByLabelText('Expected stdout (may be empty)').value).toBe('');
  fireEvent.change(screen.getByLabelText('Points'), { target: { value: '100' } });
  expect(screen.getByText('Java test groups · 100/100 points')).toBeTruthy();
  expect(screen.getByLabelText('Visibility').value).toBe('private');
});
