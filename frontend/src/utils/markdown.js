import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  breaks: true,
  gfm: true
});

let purifierInstance = null;

const getPurifier = () => {
  if (purifierInstance) {
    return purifierInstance;
  }
  if (DOMPurify?.sanitize) {
    purifierInstance = DOMPurify;
    return purifierInstance;
  }
  if (typeof window !== 'undefined') {
    purifierInstance = DOMPurify(window);
    return purifierInstance;
  }
  return null;
};

const sanitizeHtml = (html) => {
  const purifier = getPurifier();
  if (!purifier) {
    return html;
  }
  return purifier.sanitize(html, { USE_PROFILES: { html: true } });
};

export const renderMarkdownToSafeHtml = (content) => {
  if (typeof content !== 'string') {
    return '';
  }
  if (!content.trim()) {
    return '';
  }
  const rendered = marked.parse(content);
  return sanitizeHtml(rendered);
};

export default renderMarkdownToSafeHtml;
