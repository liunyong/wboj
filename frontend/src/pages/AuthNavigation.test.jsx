import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import LoginPage from './LoginPage.jsx';
import RegisterPage from './RegisterPage.jsx';

const auth = vi.hoisted(() => ({ user: null, isLoading: false, login: vi.fn() }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }));
vi.mock('../components/TurnstileWidget.jsx', () => ({ default: () => null }));

function Destination() {
  const location = useLocation();
  return <output data-testid="destination">{location.pathname}{location.search}{location.hash}</output>;
}
function mount(entry) {
  render(<MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="*" element={<Destination />} />
  </Routes></MemoryRouter>);
}
beforeEach(() => { auth.user = null; auth.isLoading = false; auth.login.mockResolvedValue({ id: 'user' }); });
afterEach(cleanup);

it.each([
  [{ pathname: '/login', state: { from: { pathname: '/register', search: '?source=sidebar' } } }, '/dashboard'],
  [{ pathname: '/login', state: { from: '/register/' } }, '/dashboard'],
  ['/login?redirect=%2Fregister', '/dashboard'],
  ['/login?redirect=%2F%2Fexample.com', '/dashboard'],
  [{ pathname: '/login', state: { from: { pathname: '/problems/100008', search: '?tab=code', hash: '#submit' } } }, '/problems/100008?tab=code#submit'],
  ['/login?redirect=%2Fsubmissions%3Fpage%3D2', '/submissions?page=2']
])('returns to a valid destination after login (%j)', async (entry, destination) => {
  mount(entry);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Login' }));
  expect(await screen.findByTestId('destination')).toHaveTextContent(destination);
});

it('redirects signed-in users away from registration', async () => {
  auth.user = { id: 'user' };
  mount('/register');
  expect(await screen.findByTestId('destination')).toHaveTextContent('/dashboard');
});

it('waits for session loading before displaying the registration form', () => {
  auth.isLoading = true;
  mount('/register');
  expect(screen.getByRole('status')).toHaveTextContent('Loading session');
  expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
});
