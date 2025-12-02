import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext.jsx';

const API_BASE = import.meta.env.VITE_API_URL || '';

const formatSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatDate = (iso) => {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
};

function AdminUploadsPage() {
  const { authFetch } = useAuth();
  const queryClient = useQueryClient();
  const [previewImage, setPreviewImage] = useState(null);

  const uploadsQuery = useQuery({
    queryKey: ['uploads', 'images'],
    queryFn: async () => {
      const response = await authFetch('/api/uploads/images');
      return response?.items ?? [];
    },
    staleTime: 30_000
  });

  const deleteMutation = useMutation({
    mutationFn: async (filename) => {
      return authFetch(`/api/uploads/images/${filename}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads', 'images'] });
    }
  });

  const items = uploadsQuery.data ?? [];

  const totalSize = useMemo(
    () => items.reduce((sum, item) => sum + (item.size ?? 0), 0),
    [items]
  );

  const handleDelete = (filename) => {
    if (!filename) {
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to delete ${filename}? This action cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(filename);
  };

  return (
    <section className="page admin-uploads-page">
      <header className="page-header">
        <div>
          <h1>Image Uploads</h1>
          <p>Manage images stored under /uploads/problems. Delete unused files to free space.</p>
        </div>
      </header>

      <div className="admin-card uploads-summary">
        <div>
          <strong>Total Images:</strong> {items.length}
        </div>
        <div>
          <strong>Total Size:</strong> {formatSize(totalSize)}
        </div>
      </div>

      {uploadsQuery.isLoading ? (
        <div className="admin-card">
          <div className="page-message">Loading uploads…</div>
        </div>
      ) : uploadsQuery.isError ? (
        <div className="admin-card">
          <div className="page-message error">
            {uploadsQuery.error?.message || 'Failed to load uploaded images.'}
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="admin-card">
          <div className="page-message">No uploaded images found.</div>
        </div>
      ) : (
        <div className="uploads-grid">
          {items.map((item) => (
            <article key={item.name} className="upload-card">
              <button
                type="button"
                className="upload-card__preview"
                onClick={() => setPreviewImage(resolveImageUrl(item))}
              >
                <img src={resolveImageUrl(item)} alt={item.name} loading="lazy" />
              </button>
              <div className="upload-card__details">
                <div className="upload-card__name" title={item.name}>
                  {item.name}
                </div>
                <div className="upload-card__meta">
                  <span>{formatSize(item.size)}</span>
                  <span>·</span>
                  <span>{formatDate(item.modifiedAt)}</span>
                </div>
                <div className="upload-card__url">
                  <code>{item.path || item.apiPath || item.url}</code>
                  <button
                    type="button"
                    onClick={() => {
                      const text = item.path || item.apiPath || item.url;
                      navigator.clipboard.writeText(text).catch(() => {});
                    }}
                  >
                    Copy
                  </button>
                </div>
                <div className="upload-card__actions">
                  <a href={resolveImageUrl(item)} target="_blank" rel="noopener noreferrer">
                    Open
                  </a>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleDelete(item.name)}
                    disabled={deleteMutation.isLoading}
                  >
                    {deleteMutation.isLoading ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {previewImage && (
        <div
          className="confirm-modal-backdrop"
          role="presentation"
          onClick={() => setPreviewImage(null)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setPreviewImage(null);
            }
          }}
        >
          <div
            className="confirm-modal upload-preview-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="submission-modal__header">
              <h2>Preview</h2>
              <button type="button" className="icon-button" onClick={() => setPreviewImage(null)}>
                ×
              </button>
            </header>
            <div className="upload-preview-body">
              <img src={previewImage} alt="Preview" loading="lazy" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default AdminUploadsPage;
const resolveImageUrl = (item) => {
  if (!item) {
    return '';
  }
  const candidate = item.apiPath || item.path || item.url;
  if (!candidate) {
    return '';
  }
  if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
    return candidate;
  }
  if (API_BASE) {
    try {
      return new URL(candidate, `${API_BASE.replace(/\/$/, '')}/`).toString();
    } catch (_error) {
      return candidate;
    }
  }
  return candidate;
};
