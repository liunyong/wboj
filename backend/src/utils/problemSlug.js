const slugifyTitle = (title = '') =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const buildProblemSlug = (title, problemId) => {
  const normalizedTitle = slugifyTitle(title);
  const suffix = Number.isFinite(problemId) ? String(problemId) : '';

  if (!normalizedTitle) {
    return suffix ? `problem-${suffix}` : null;
  }

  return suffix ? `${normalizedTitle}-${suffix}` : normalizedTitle;
};
