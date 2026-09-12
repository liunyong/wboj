export function getLoginRedirect(search, state) {
  const from = state?.from;
  const candidate = new URLSearchParams(search).get('redirect') ||
    (typeof from === 'string' ? from : from?.pathname
      ? `${from.pathname}${from.search || ''}${from.hash || ''}` : '');
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return '/dashboard';
  }
  try {
    const target = new URL(candidate, 'https://wboj.app');
    const pathname = decodeURIComponent(target.pathname).replace(/\/+$/, '').toLowerCase();
    if (['/login', '/register'].includes(pathname)) return '/dashboard';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/dashboard';
  }
}
