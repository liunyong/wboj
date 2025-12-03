import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import {
  formatRelativeOrDate,
  formatTooltip,
  getUserTZ
} from '../utils/time.js';
import { siteMeta, summarizeText } from '../utils/seo.js';
import { usePageSeo } from '../hooks/useSeo.js';

function HomePage() {
  const { authFetch, user } = useAuth();
  const isAdmin = ['admin', 'super_admin'].includes(user?.role);
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState({ title: '', body: '', pinned: false });
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: '', body: '', pinned: false });
  const [formError, setFormError] = useState('');
  const userTimeZone = getUserTZ();
  const nowMs = Date.now();

  const announcementsQuery = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const response = await authFetch('/api/announcements?limit=20&pinnedFirst=true', {}, { skipAuth: true });
      return response?.items ?? [];
    }
  });

  const updatesQuery = useQuery({
    queryKey: ['problem-updates'],
    queryFn: async () => {
      const response = await authFetch('/api/problem-updates?limit=20', {}, { skipAuth: true });
      return response?.items ?? [];
    }
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: ({ title, body, pinned }) =>
      authFetch(
        '/api/announcements',
        {
          method: 'POST',
          body: { title, body, pinned }
        },
        { retry: false }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setCreateDraft({ title: '', body: '', pinned: false });
      setIsCreating(false);
      setFormError('');
    },
    onError: (error) => {
      setFormError(error.message || 'Failed to create announcement.');
    }
  });

  const updateAnnouncementMutation = useMutation({
    mutationFn: ({ id, updates }) =>
      authFetch(
        `/api/announcements/${id}`,
        {
          method: 'PUT',
          body: updates
        },
        { retry: false }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setEditingId(null);
      setEditDraft({ title: '', body: '', pinned: false });
      setFormError('');
    },
    onError: (error) => {
      setFormError(error.message || 'Failed to update announcement.');
    }
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: (id) =>
      authFetch(
        `/api/announcements/${id}`,
        {
          method: 'DELETE'
        },
        { retry: false }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    }
  });

  const announcements = announcementsQuery.data ?? [];
  const problemUpdates = updatesQuery.data ?? [];

  const seoConfig = useMemo(() => {
    const latestAnnouncements = announcements.slice(0, 5);
    const latestUpdates = problemUpdates.slice(0, 5);

    return {
      title: 'WBOJ | WB Online Judge for Coding, Algorithms, and Competitive Programming',
      description: 'Practice coding, solve algorithm problems, and track updates on the WB Online Judge platform.',
      titleKo: 'WBOJ | WB 온라인 저지 플랫폼',
      descriptionKo: '코딩 연습, 알고리즘 문제 풀이, 플랫폼 공지와 업데이트를 한곳에서 확인하세요.',

      path: '/',
      jsonLd: [
        {
          id: 'home-announcements',
          data: {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'WB Online Judge Announcements',
            url: `${siteMeta.siteUrl}/`,
            inLanguage: ['en', 'ko'],
            isPartOf: { '@type': 'WebSite', '@id': `${siteMeta.siteUrl}#website` },
            itemListElement: latestAnnouncements.map((announcement, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              url: `${siteMeta.siteUrl}/?announcement=${announcement._id ?? announcement.id ?? index}`,
              name: announcement.title,
              description: summarizeText(announcement.body ?? '')
            }))
          }
        },
        {
          id: 'home-updates',
          data: {
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: 'Problem Changelog',
            url: `${siteMeta.siteUrl}/problems`,
            blogPost: latestUpdates.map((entry) => ({
              '@type': 'BlogPosting',
              headline: entry.title ?? entry.problemTitle ?? 'Problem update',
              url: `${siteMeta.siteUrl}/problems/${entry.problemId ?? ''}`,
              dateModified: entry.updatedAt ?? entry.createdAt ?? new Date().toISOString(),
              inLanguage: ['en', 'ko']
            }))
          }
        },
        {
          id: 'site-search',
          data: {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            '@id': `${siteMeta.siteUrl}#website`,
            name: 'WB Online Judge',
            url: siteMeta.siteUrl,
            potentialAction: {
              '@type': 'SearchAction',
              target: `${siteMeta.siteUrl}/problems?query={search_term_string}`,
              'query-input': 'required name=search_term_string'
            }
          }
        }
      ]
    };
  }, [announcements, problemUpdates]);

  usePageSeo(seoConfig);

  const isEditing = (id) => editingId === id;

  const handleCreateSubmit = (event) => {
    event.preventDefault();
    if (!createDraft.title.trim() || !createDraft.body.trim()) {
      setFormError('Title and body are required.');
      return;
    }
    createAnnouncementMutation.mutate({
      title: createDraft.title.trim(),
      body: createDraft.body.trim(),
      pinned: Boolean(createDraft.pinned)
    });
  };

  const handleEditSubmit = (event) => {
    event.preventDefault();
    if (!editingId) {
      return;
    }
    if (!editDraft.title.trim() || !editDraft.body.trim()) {
      setFormError('Title and body are required.');
      return;
    }
    updateAnnouncementMutation.mutate({
      id: editingId,
      updates: {
        title: editDraft.title.trim(),
        body: editDraft.body.trim(),
        pinned: Boolean(editDraft.pinned)
      }
    });
  };

  return (
    <section className="page home-page">
      <header className="page-header">
        <div>
          <h1>Welcome</h1>
          <p>Catch up on platform announcements and recent problem changes.</p>
        </div>
      </header>

      <div className="home-grid">
        <div className="home-announcements">
          <div className="section-header">
            <h2>Announcements</h2>
            {isAdmin && !isCreating && (
              <button type="button" className="primary" onClick={() => setIsCreating(true)}>
                New Announcement
              </button>
            )}
          </div>

          {isAdmin && isCreating && (
            <form className="announcement-form" onSubmit={handleCreateSubmit}>
              <label>
                Title
                <input
                  type="text"
                  value={createDraft.title}
                  onChange={(event) =>
                    setCreateDraft((prev) => ({ ...prev, title: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Body
                <textarea
                  value={createDraft.body}
                  onChange={(event) =>
                    setCreateDraft((prev) => ({ ...prev, body: event.target.value }))
                  }
                  rows={4}
                  required
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={createDraft.pinned}
                  onChange={(event) =>
                    setCreateDraft((prev) => ({ ...prev, pinned: event.target.checked }))
                  }
                />
                Pin announcement
              </label>
              {formError && <div className="form-message error">{formError}</div>}
              <div className="form-actions">
                <button type="submit" className="primary" disabled={createAnnouncementMutation.isLoading}>
                  {createAnnouncementMutation.isLoading ? 'Creating…' : 'Publish'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setIsCreating(false);
                    setFormError('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {announcementsQuery.isLoading && <div className="page-message">Loading announcements…</div>}
          {announcementsQuery.isError && (
            <div className="page-message error">Failed to load announcements.</div>
          )}

          {!announcementsQuery.isLoading && announcements.length === 0 && (
            <div className="page-message">No announcements yet.</div>
          )}

          <ul className="announcement-list">
            {announcements.map((announcement) => {
              const isEditingCurrent = isEditing(announcement.id);
              return (
                <li key={announcement.id} className={announcement.pinned ? 'pinned' : ''}>
                  {isEditingCurrent ? (
                    <form className="announcement-form" onSubmit={handleEditSubmit}>
                      <label>
                        Title
                        <input
                          type="text"
                          value={editDraft.title}
                          onChange={(event) =>
                            setEditDraft((prev) => ({ ...prev, title: event.target.value }))
                          }
                          required
                        />
                      </label>
                      <label>
                        Body
                        <textarea
                          value={editDraft.body}
                          onChange={(event) =>
                            setEditDraft((prev) => ({ ...prev, body: event.target.value }))
                          }
                          rows={4}
                          required
                        />
                      </label>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={Boolean(editDraft.pinned)}
                          onChange={(event) =>
                            setEditDraft((prev) => ({ ...prev, pinned: event.target.checked }))
                          }
                        />
                        Pin announcement
                      </label>
                      {formError && <div className="form-message error">{formError}</div>}
                      <div className="form-actions">
                        <button
                          type="submit"
                          className="primary"
                          disabled={updateAnnouncementMutation.isLoading}
                        >
                          {updateAnnouncementMutation.isLoading ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => {
                            setEditingId(null);
                            setFormError('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <article className="announcement-card">
                      <header>
                        <div>
                          <h3>{announcement.title}</h3>
                          <p className="announcement-meta">
                            {announcement.pinned ? <span className="badge">Pinned</span> : null}
                            <span
                              title={
                                announcement.createdAt
                                  ? formatTooltip(announcement.createdAt, userTimeZone)
                                  : '—'
                              }
                            >
                              {formatRelativeOrDate(announcement.createdAt, nowMs, userTimeZone)}
                            </span>
                          </p>
                        </div>
                        {isAdmin && (
                          <div className="announcement-actions">
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => {
                                setEditingId(announcement.id);
                                setFormError('');
                                setEditDraft({
                                  title: announcement.title,
                                  body: announcement.body,
                                  pinned: announcement.pinned
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() =>
                                updateAnnouncementMutation.mutate({
                                  id: announcement.id,
                                  updates: { pinned: !announcement.pinned }
                                })
                              }
                            >
                              {announcement.pinned ? 'Unpin' : 'Pin'}
                            </button>
                            <button
                              type="button"
                              className="danger"
                              onClick={() => deleteAnnouncementMutation.mutate(announcement.id)}
                              disabled={deleteAnnouncementMutation.isLoading}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </header>
                      <p className="announcement-body">{announcement.body}</p>
                    </article>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="home-updates">
          <div className="section-header">
            <h2>Problem Updates</h2>
            <Link to="/problems" className="secondary">
              Browse Problems
            </Link>
          </div>

          {updatesQuery.isLoading && <div className="page-message">Loading updates…</div>}
          {updatesQuery.isError && (
            <div className="page-message error">Failed to load problem updates.</div>
          )}

          {!updatesQuery.isLoading && problemUpdates.length === 0 && (
            <div className="page-message">No recent updates.</div>
          )}

          <ul className="updates-list">
            {problemUpdates.map((update) => (
              <li key={update.id}>
                <h3>
                  <Link to={`/problems/${update.problemId}`}>{update.titleSnapshot}</Link>
                </h3>
                <p>{update.summary}</p>
                <span
                  className="update-date"
                  title={update.createdAt ? formatTooltip(update.createdAt, userTimeZone) : '—'}
                >
                  {formatRelativeOrDate(update.createdAt, nowMs, userTimeZone)}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}

export default HomePage;
