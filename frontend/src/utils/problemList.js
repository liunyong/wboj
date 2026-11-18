const DEFAULT_PAGE_SIZE = 50;
export const PAGE_SIZE_OPTIONS = [20, 50, 100];
export const SORT_COLUMNS = [
  { field: 'id', label: 'ID', defaultDirection: 'asc' },
  { field: 'title', label: 'Title', defaultDirection: 'asc' },
  { field: 'difficulty', label: 'Difficulty Rating', defaultDirection: 'asc' },
  { field: 'submissions', label: 'Submissions', defaultDirection: 'desc' },
  { field: 'acceptance', label: 'AC Rate', defaultDirection: 'desc' }
];

export function getProblemListOptions(searchParams, isAdmin) {
  const search = searchParams.get('q') ?? '';
  const requestedVisibility = searchParams.get('visibility');
  const visibility = isAdmin
    ? (['public', 'private'].includes(requestedVisibility) ? requestedVisibility : 'all')
    : 'public';
  const tagFilter = searchParams.get('tag') ?? '';
  const requestedPage = Number(searchParams.get('page') ?? '1');
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedPageSize = Number(searchParams.get('limit'));
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize) ? requestedPageSize : DEFAULT_PAGE_SIZE;
  const requestedSort = searchParams.get('sort');
  const sort = SORT_COLUMNS.some(({ field }) =>
    requestedSort === `${field}-asc` || requestedSort === `${field}-desc`
  ) ? requestedSort : 'id-asc';
  return { search, visibility, tagFilter, page, pageSize, sort };
}

function compareProblems(a, b, sort) {
  const [field, direction] = sort.split('-');
  const compareId = () => Number(a.problemId) - Number(b.problemId);
  let result = 0;

  if (field === 'title') {
    result = (a.title ?? '').localeCompare(b.title ?? '', undefined, { numeric: true });
  } else if (field === 'difficulty' || field === 'acceptance') {
    const value = (problem) => field === 'difficulty'
      ? problem.difficultyRating
      : problem.submissionCount > 0
        ? (problem.acceptedSubmissionCount ?? 0) / problem.submissionCount
        : null;
    const left = value(a);
    const right = value(b);
    // Keep unrated problems and problems without submissions last in either direction.
    if (!Number.isFinite(left) || !Number.isFinite(right)) {
      if (Number.isFinite(left)) return -1;
      if (Number.isFinite(right)) return 1;
      return compareId();
    }
    result = left - right;
  } else if (field === 'submissions') {
    result = (a.submissionCount ?? 0) - (b.submissionCount ?? 0);
  } else {
    result = compareId();
  }

  return (direction === 'desc' ? -result : result) || compareId();
}

export function filterAndSortProblems(items, { search, tagFilter, sort }) {
  const trimmed = search.trim().toLowerCase();
  let results = items;

  if (trimmed) {
    results = results.filter((problem) => {
      const fields = [
        problem.title,
        problem.problemId ? `#${problem.problemId}` : '',
        ...(problem.algorithms ?? []),
        ...(problem.tags ?? [])
      ];
      return fields
        .filter(Boolean)
        .map((value) => value.toString().toLowerCase())
        .some((value) => value.includes(trimmed));
    });
  }

  if (tagFilter) {
    results = results.filter((problem) => (problem.tags ?? []).includes(tagFilter));
  }

  return [...results].sort((a, b) => compareProblems(a, b, sort));
}
