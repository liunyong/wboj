const getWindow = () => (typeof window !== 'undefined' ? window : null);

export const DEFAULT_HREFLANG_LOCALES = [
  { hrefLang: 'en', value: 'en', default: true },
  { hrefLang: 'ko', value: 'ko' }
];

const buildUrlForLocale = ({ origin, path, locale, localeParam = 'lang' }) => {
  try {
    const url = new URL(path || '/', origin);
    const paramName = locale.param || localeParam;
    if (locale.default) {
      url.searchParams.delete(paramName);
    } else if (locale.value) {
      url.searchParams.set(paramName, locale.value);
    }
    return url.toString();
  } catch (error) {
    return `${origin}${path || '/'}`;
  }
};

export const setHrefLangLinks = ({
  baseUrl,
  path,
  locales = DEFAULT_HREFLANG_LOCALES,
  localeParam = 'lang'
} = {}) => {
  if (typeof document === 'undefined') {
    return;
  }
  const win = getWindow();
  const origin = (baseUrl && baseUrl.replace(/\/$/, '')) || (win ? win.location.origin : '');
  const head = document.head;
  const managed = head.querySelectorAll('link[rel="alternate"][data-managed="hreflang"]');
  managed.forEach((node) => node.remove());

  const localeList = [...locales];
  if (!localeList.some((item) => item.hrefLang === 'x-default')) {
    localeList.push({ hrefLang: 'x-default', value: null, default: true });
  }

  localeList.forEach((locale) => {
    const href = buildUrlForLocale({ origin, path, locale, localeParam });
    const link = document.createElement('link');
    link.setAttribute('rel', 'alternate');
    link.setAttribute('hreflang', locale.hrefLang);
    link.setAttribute('href', href);
    link.setAttribute('data-managed', 'hreflang');
    head.appendChild(link);
  });
};
