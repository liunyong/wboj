import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const PAGE_SIZE = 25;

function AdminUsersPage() {
  const { authFetch, user } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === 'super_admin';
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [pendingDeletion, setPendingDeletion] = useState([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', { page, search, role, status }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      if (role) params.set('role', role);
      if (status) params.set('isActive', status);
      return authFetch(`/api/admin/users?${params}`);
    },
    placeholderData: (previous) => previous
  });

  const refreshUsers = () => {
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  };

  const roleMutation = useMutation({
    mutationFn: ({ id, nextRole }) =>
      authFetch(`/api/admin/users/${id}/role`, { method: 'PATCH', body: { role: nextRole } }),
    onSuccess: refreshUsers
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }) =>
      authFetch(`/api/admin/users/${id}/deactivate`, {
        method: 'PATCH',
        body: { isActive }
      }),
    onSuccess: refreshUsers
  });

  const deleteMutation = useMutation({
    mutationFn: (ids) =>
      ids.length === 1
        ? authFetch(`/api/admin/users/${ids[0]}`, { method: 'DELETE' })
        : authFetch('/api/admin/users/bulk', { method: 'DELETE', body: { ids } }),
    onSuccess: async (_data, deletedIds) => {
      const deletedSet = new Set(deletedIds);
      queryClient.setQueriesData({ queryKey: ['admin', 'users'] }, (cached) => {
        if (!cached?.items) return cached;
        const items = cached.items.filter((entry) => !deletedSet.has(entry.id));
        const removed = cached.items.length - items.length;
        const total = Math.max(0, (cached.total ?? 0) - removed);
        return {
          ...cached,
          items,
          total,
          totalPages: Math.max(1, Math.ceil(total / (cached.limit || PAGE_SIZE)))
        };
      });
      setPendingDeletion([]);
      setSelectedIds(new Set());
      if ((usersQuery.data?.items?.length ?? 0) <= deletedIds.length && page > 1) {
        setPage((current) => current - 1);
      }
      await queryClient.refetchQueries({ queryKey: ['admin', 'users'], type: 'active' });
    }
  });

  const items = usersQuery.data?.items ?? [];
  const total = usersQuery.data?.total ?? 0;
  const totalPages = usersQuery.data?.totalPages ?? 1;
  const selectableIds = useMemo(
    () => items.filter((entry) => entry.id !== user?.id).map((entry) => entry.id),
    [items, user?.id]
  );
  const allPageSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  const toggleAll = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allPageSelected) selectableIds.forEach((id) => next.delete(id));
      else selectableIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleOne = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="page admin-page users-admin-page">
      <header className="page-header">
        <div>
          <h1>User Management</h1>
          <p>Search accounts, manage access, and permanently remove user data.</p>
          {!isSuperAdmin && (
            <p className="muted">Role changes and deletion are restricted to super admins.</p>
          )}
        </div>
      </header>

      <div className="admin-card users-admin-card">
        <div className="users-toolbar">
          <label className="users-search">
            <span className="sr-only">Search users</span>
            <input
              type="search"
              value={searchInput}
              placeholder="Search username, email, or display name"
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>
          <select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}>
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super admin</option>
          </select>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          {isSuperAdmin && (
            <button
              type="button"
              className="danger users-bulk-delete"
              disabled={!selectedIds.size || deleteMutation.isPending}
              onClick={() => setPendingDeletion([...selectedIds])}
            >
              Delete selected ({selectedIds.size})
            </button>
          )}
        </div>

        {deleteMutation.isError && (
          <div className="form-message error">{deleteMutation.error.message}</div>
        )}
        {usersQuery.isLoading && <div className="users-loading">Loading users…</div>}
        {usersQuery.isError && <div className="form-message error">Failed to load users.</div>}

        {!usersQuery.isLoading && !usersQuery.isError && (
          <>
            <div className="users-table-wrap">
              <table className="users-table">
                <thead>
                  <tr>
                    {isSuperAdmin && (
                      <th className="users-select-column">
                        <input
                          type="checkbox"
                          aria-label="Select all users on this page"
                          checked={allPageSelected}
                          onChange={toggleAll}
                        />
                      </th>
                    )}
                    <th>User</th>
                    <th>Verification</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Profile</th>
                    <th className="users-actions-heading">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((entry) => {
                    const isSelf = entry.id === user?.id;
                    return (
                      <tr key={entry.id} className={selectedIds.has(entry.id) ? 'is-selected' : ''}>
                        {isSuperAdmin && (
                          <td className="users-select-column">
                            <input
                              type="checkbox"
                              aria-label={`Select ${entry.username}`}
                              checked={selectedIds.has(entry.id)}
                              disabled={isSelf}
                              onChange={() => toggleOne(entry.id)}
                            />
                          </td>
                        )}
                        <td>
                          <Link className="users-identity" to={`/u/${entry.username}`}>
                            <strong>{entry.username}</strong>
                            <span>{entry.email}</span>
                          </Link>
                          {isSelf && <span className="users-you-badge">You</span>}
                        </td>
                        <td><span className={`status-badge ${entry.emailVerified ? 'accepted' : 'queued'}`}>{entry.emailVerified ? 'Verified' : 'Pending'}</span></td>
                        <td><span className="users-role-badge">{entry.role.replace('_', ' ')}</span></td>
                        <td><span className={`status-badge ${entry.isActive ? 'accepted' : 'failed'}`}>{entry.isActive ? 'Active' : 'Inactive'}</span></td>
                        <td>{entry.profilePublic ? 'Public' : 'Private'}</td>
                        <td className="admin-actions">
                          {isSuperAdmin ? (
                            <div className="admin-actions__controls">
                              <select
                                aria-label={`Role for ${entry.username}`}
                                value={entry.role}
                                disabled={isSelf || roleMutation.isPending}
                                onChange={(event) => roleMutation.mutate({ id: entry.id, nextRole: event.target.value })}
                              >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                                <option value="super_admin">Super admin</option>
                              </select>
                              <button
                                type="button"
                                className="secondary"
                                disabled={isSelf || statusMutation.isPending}
                                onClick={() => statusMutation.mutate({ id: entry.id, isActive: !entry.isActive })}
                              >
                                {entry.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                className="danger"
                                disabled={isSelf || deleteMutation.isPending}
                                onClick={() => setPendingDeletion([entry.id])}
                              >
                                Delete
                              </button>
                            </div>
                          ) : <span className="muted">View only</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {!items.length && <tr><td colSpan={isSuperAdmin ? 7 : 6} className="users-empty">No users match these filters.</td></tr>}
                </tbody>
              </table>
            </div>

            <footer className="users-table-footer">
              <span>Showing {items.length} of {total} users</span>
              <div className="pagination">
                <button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
                <span>Page {page} of {totalPages}</span>
                <button type="button" className="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
              </div>
            </footer>
          </>
        )}
      </div>

      <ConfirmDialog
        open={pendingDeletion.length > 0}
        title={`Permanently delete ${pendingDeletion.length} user${pendingDeletion.length === 1 ? '' : 's'}?`}
        confirmLabel="Delete permanently"
        isConfirming={deleteMutation.isPending}
        onCancel={() => setPendingDeletion([])}
        onConfirm={() => deleteMutation.mutate(pendingDeletion)}
      >
        <p>This permanently removes the selected accounts, submissions, solved history, and daily statistics.</p>
        <p><strong>This action cannot be undone.</strong></p>
      </ConfirmDialog>
    </section>
  );
}

export default AdminUsersPage;
