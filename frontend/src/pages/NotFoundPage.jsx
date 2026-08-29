import { Link } from 'react-router-dom';

import { usePageSeo } from '../hooks/useSeo.js';

export default function NotFoundPage() {
  usePageSeo({ title: 'Page not found', description: 'The requested page does not exist.' });

  return (
    <main className="page-shell">
      <section className="panel empty-state">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>The address may be incorrect or the page may have moved.</p>
        <Link className="button primary" to="/">Go home</Link>
      </section>
    </main>
  );
}
