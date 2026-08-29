import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './styles.css';
import { ensureDefaultMeta, siteMeta } from './utils/seo.js';
import { DEFAULT_HREFLANG_LOCALES, setHrefLangLinks } from './utils/hreflang.js';
import { preloadTurnstile } from './components/TurnstileWidget.jsx';

ensureDefaultMeta();
if (typeof window !== 'undefined') {
  preloadTurnstile().catch(() => {});
  setHrefLangLinks({
    baseUrl: siteMeta.siteUrl,
    path: `${window.location.pathname}${window.location.search}`,
    locales: DEFAULT_HREFLANG_LOCALES
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
