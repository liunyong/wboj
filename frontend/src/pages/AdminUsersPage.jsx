import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

function AdminUsersPage() {
  const { authFetch, user } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = ['admin', 'super_admin'].includes(user?.role);

  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const response = await authFetch('/api/admin/users');
      return response?.items ?? [];
    }
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }) =>
      authFetch(`/api/admin/users/${id}/role`, { method: 'PATCH', body: { role } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }) =>
      authFetch(`/api/admin/users/${id}/deactivate`, {
        method: 'PATCH',
        body: { isActive }
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => authFetch(`/api/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
  });

  return (
    <section className="page admin-page">
      <header className="page-header">
        <div>
          <h1>User Management</h1>
          <p>Promote administrators and deactivate accounts.</p>
          {!isSuperAdmin && (
            <p className="muted">Administrative changes are restricted to super admins.</p>
          )}
        </div>
      </header>

      <div className="admin-card">
        <h2>Users</h2>
        {usersQuery.isLoading && <div>Loading…</div>}
        {usersQuery.isError && <div className="form-message error">Failed to load users.</div>}
        {usersQuery.data?.length ? (
          <table className="users-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Verified</th>
                <th>Role</th>
                <th>Status</th>
                <th>Profile</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.data.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <Link to={`/u/${entry.username}`}>{entry.username}</Link>
                  </td>
                  <td>{entry.email}</td>
                  <td>{entry.emailVerified ? 'Verified' : 'Pending'}</td>
                  <td>{entry.role}</td>
                  <td>{entry.isActive ? 'Active' : 'Inactive'}</td>
                  <td>{entry.profilePublic ? 'Public' : 'Private'}</td>
                  <td className="admin-actions">
                    {isSuperAdmin ? (
                      <div className="admin-actions__controls">
                        <label className="sr-only" htmlFor={`role-${entry.id}`}>
                          Role
                        </label>
                        <select
                          id={`role-${entry.id}`}
                          value={entry.role}
                          onChange={(event) =>
                            roleMutation.mutate({ id: entry.id, role: event.target.value })
                          }
                          disabled={roleMutation.isPending}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                          <option value="super_admin">super_admin</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            statusMutation.mutate({ id: entry.id, isActive: !entry.isActive })
                          }
                          disabled={statusMutation.isPending}
                        >
                          {entry.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => deleteMutation.mutate(entry.id)}
                          disabled={deleteMutation.isLoading}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <span className="muted">Super admin only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div>No users found.</div>
        )}
      </div>
    </section>
  );
}

export default AdminUsersPage;
