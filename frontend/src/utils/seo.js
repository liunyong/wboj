const getWindow = () => (typeof window !== 'undefined' ? window : null);

const normalizeSiteUrl = (value) => {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.origin.replace(/\/$/, '');
  } catch (error) {
    return value.replace(/\/$/, '');
  }
};

const envSiteUrl = typeof import.meta !== 'undefined' ? import.meta.env.VITE_SITE_URL : null;
const fallbackWindow = getWindow();
const defaultSiteUrl =
  normalizeSiteUrl(envSiteUrl) || (fallbackWindow ? fallbackWindow.location.origin : 'https://wboj.app');

export const siteMeta = {
  siteName: 'WBOJ - WB Online Judge',
  title: 'WBOJ | WB Online Judge Platform',
  titleKo: 'WBOJ | WB 온라인 저지 플랫폼',
  description:
    'WBOJ provides coding practice, algorithm problems, and competitive programming tools with Judge0-powered execution and performance dashboards.',
  descriptionKo:
    'WBOJ는 Judge0 기반 실행 환경과 실시간 대시보드를 통해 코딩 연습, 알고리즘 문제 풀이, 경쟁 프로그래밍 학습을 지원합니다.',
  siteUrl: defaultSiteUrl,
  shareImage: `${defaultSiteUrl}/social-card.svg`
};

const managedSelector = '[data-managed="seo-meta"]';

const toPlainText = (value) => {
  if (!value || typeof value !== 'string') {
    return '';
  }
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[`*_>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const summarizeText = (value, maxLength = 160) => {
  const plain = toPlainText(value);
  if (plain.length <= maxLength) {
    return plain;
  }
  return `${plain.slice(0, maxLength - 1).trim()}…`;
};

export const buildBilingualString = (english, korean) => {
  const en = toPlainText(english);
  const ko = toPlainText(korean);
  if (en && ko) {
    return `${en} / ${ko}`;
  }
  return en || ko || '';
};

const upsertMeta = (attributes, content) => {
  if (typeof document === 'undefined') {
    return;
  }
  const head = document.head;
  const selector = Object.entries(attributes)
    .map(([key, value]) => `[${key}="${value}"]`)
    .join('');
  let node = head.querySelector(`meta${selector}`);
  if (!node) {
    node = document.createElement('meta');
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    node.setAttribute('data-managed', 'seo-meta');
    head.appendChild(node);
  }
  if (typeof content === 'string') {
    node.setAttribute('content', content);
  }
};

const upsertLink = (attributes, href) => {
  if (typeof document === 'undefined') {
    return;
  }
  const head = document.head;
  const selector = Object.entries(attributes)
    .map(([key, value]) => `[${key}="${value}"]`)
    .join('');
  let node = head.querySelector(`link${selector}`);
  if (!node) {
    node = document.createElement('link');
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    head.appendChild(node);
  }
  if (href) {
    node.setAttribute('href', href);
  }
};

const resolveAbsoluteUrl = (value) => {
  if (!value) {
    return siteMeta.siteUrl;
  }
  try {
    const url = new URL(value, siteMeta.siteUrl);
    return url.toString();
  } catch (error) {
    return value;
  }
};

const resolveImage = (value) => {
  if (!value) {
    return siteMeta.shareImage;
  }
  try {
    const url = new URL(value, siteMeta.siteUrl);
    return url.toString();
  } catch (error) {
    return siteMeta.shareImage;
  }
};

export const updateMetaTags = (overrides = {}) => {
  if (typeof document === 'undefined') {
    return;
  }
  const meta = { ...siteMeta, ...overrides };
  const pageTitleEn = meta.title || siteMeta.title;
  const pageTitleKo = meta.titleKo || siteMeta.titleKo;
  const composedTitle = buildBilingualString(pageTitleEn, pageTitleKo) || siteMeta.siteName;
  document.title = composedTitle;

  const englishDescription = meta.description || siteMeta.description;
  const koreanDescription = meta.descriptionKo || siteMeta.descriptionKo;
  const bilingualDescription = buildBilingualString(englishDescription, koreanDescription);

  upsertMeta({ name: 'description', lang: 'en', 'data-managed': 'seo-meta' }, englishDescription);
  upsertMeta({ name: 'description', lang: 'ko', 'data-managed': 'seo-meta' }, koreanDescription);
  upsertMeta({ property: 'og:title', 'data-managed': 'seo-meta' }, composedTitle);
  upsertMeta({ property: 'og:description', 'data-managed': 'seo-meta' }, bilingualDescription);
  upsertMeta({ property: 'og:type', 'data-managed': 'seo-meta' }, meta.ogType || 'website');
  upsertMeta({ property: 'og:url', 'data-managed': 'seo-meta' }, resolveAbsoluteUrl(meta.url || siteMeta.siteUrl));
  upsertMeta({ property: 'og:image', 'data-managed': 'seo-meta' }, resolveImage(meta.image || siteMeta.shareImage));
  upsertMeta({ name: 'twitter:title', 'data-managed': 'seo-meta' }, composedTitle);
  upsertMeta({ name: 'twitter:description', 'data-managed': 'seo-meta' }, bilingualDescription);
  upsertMeta({ name: 'twitter:image', 'data-managed': 'seo-meta' }, resolveImage(meta.image || siteMeta.shareImage));
  upsertMeta({ name: 'twitter:card', 'data-managed': 'seo-meta' }, meta.twitterCard || 'summary_large_image');

  const canonicalUrl = resolveAbsoluteUrl(meta.url || siteMeta.siteUrl);
  upsertLink({ rel: 'canonical', 'data-managed': 'seo-meta' }, canonicalUrl);
};

export const ensureDefaultMeta = () => updateMetaTags(siteMeta);

export const applyJsonLd = (entries = []) => {
  if (typeof document === 'undefined') {
    return;
  }
  const managedScripts = document.head.querySelectorAll('script[type="application/ld+json"][data-managed="seo-jsonld"]');
  managedScripts.forEach((node) => {
    const id = node.getAttribute('data-jsonld-id');
    const stillNeeded = entries.some((entry) => entry?.id === id);
    if (!stillNeeded) {
      node.remove();
    }
  });

  entries.forEach((entry) => {
    if (!entry || !entry.id || !entry.data) {
      return;
    }
    let node = document.head.querySelector(
      `script[type="application/ld+json"][data-managed="seo-jsonld"][data-jsonld-id="${entry.id}"]`
    );
    if (!node) {
      node = document.createElement('script');
      node.type = 'application/ld+json';
      node.setAttribute('data-managed', 'seo-jsonld');
      node.setAttribute('data-jsonld-id', entry.id);
      document.head.appendChild(node);
    }
    node.textContent = JSON.stringify(entry.data, null, 2);
  });
};
