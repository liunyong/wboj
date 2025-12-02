import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { applyJsonLd, siteMeta, updateMetaTags } from '../utils/seo.js';
import { DEFAULT_HREFLANG_LOCALES, setHrefLangLinks } from '../utils/hreflang.js';

export const usePageSeo = (config) => {
  const location = useLocation();
  const serializedJsonLd = JSON.stringify(config?.jsonLd ?? []);
  const {
    title,
    titleKo,
    description,
    descriptionKo,
    image,
    ogType,
    url,
    path,
    locales
  } = config || {};

  useEffect(() => {
    if (!config) {
      applyJsonLd([]);
      return;
    }

    const nextPath = path || location.pathname;
    const nextUrl = url || `${siteMeta.siteUrl}${nextPath}`;

    updateMetaTags({
      title,
      titleKo,
      description,
      descriptionKo,
      image,
      ogType,
      url: nextUrl
    });

    setHrefLangLinks({
      baseUrl: siteMeta.siteUrl,
      path: `${location.pathname}${location.search}`,
      locales: locales || DEFAULT_HREFLANG_LOCALES
    });

    applyJsonLd(config.jsonLd || []);
  }, [
    location.pathname,
    location.search,
    title,
    titleKo,
    description,
    descriptionKo,
    image,
    ogType,
    url,
    path,
    serializedJsonLd,
    locales
  ]);
};
