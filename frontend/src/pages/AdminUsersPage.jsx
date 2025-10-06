import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext.jsx';

function AdminUsersPage() {
  const { authFetch } = useAuth();
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const response = await authFetch('/api/users');
      return response?.items ?? [];
    }
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }) =>
      authFetch(`/api/users/${id}/role`, { method: 'PATCH', body: { role } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }) =>
      authFetch(`/api/users/${id}/status`, { method: 'PATCH', body: { isActive } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
  });

  return (
    <section className="page admin-page">
      <header className="page-header">
        <div>
          <h1>User Management</h1>
          <p>Promote administrators and deactivate accounts.</p>
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
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.data.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="admin-actions">
                    <button
                      type="button"
                      onClick={() =>
                        roleMutation.mutate({
                          id: user.id,
                          role: user.role === 'admin' ? 'user' : 'admin'
                        })
                      }
                    >
                      {user.role === 'admin' ? 'Demote' : 'Promote'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        statusMutation.mutate({ id: user.id, isActive: !user.isActive })
                      }
                    >
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
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
