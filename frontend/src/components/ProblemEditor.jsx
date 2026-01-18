import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import ProblemStatement from './ProblemStatement.jsx';
import TestCaseModal from './TestCaseModal.jsx';
import ValidateTestCasesModal from './ValidateTestCasesModal.jsx';
import SampleModal from './SampleModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const selectStatementSource = (markdown, fallback) => {
  if (typeof markdown === 'string' && markdown.trim()) {
    return markdown;
  }
  if (typeof fallback === 'string') {
    return fallback;
  }
  return '';
};

const buildDefaultForm = () => ({
  title: '',
  statementMd: '',
  source: '',
  difficulty: 'BASIC',
  isPublic: true,
  inputFormat: '',
  outputFormat: '',
  constraints: '',
  cpuTimeLimit: '2',
  memoryLimit: '128',
  tags: [],
  algorithms: []
});

const generateUid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function ProblemEditor({ mode = 'create', initialProblem = null, onSuccess }) {
  const isEdit = mode === 'edit';
  const { authFetch } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const statementTextareaRef = useRef(null);

  const [form, setForm] = useState(buildDefaultForm);
  const [testCases, setTestCases] = useState([]);
  const [samples, setSamples] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([71]);
  const [languageSelection, setLanguageSelection] = useState('71');
  const [error, setError] = useState('');
  const [algorithmInput, setAlgorithmInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [trimWhitespace, setTrimWhitespace] = useState(true);
  const [zipWarnings, setZipWarnings] = useState([]);
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [isTestCaseModalOpen, setIsTestCaseModalOpen] = useState(false);
  const [editingTestCaseIndex, setEditingTestCaseIndex] = useState(null);
  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);
  const [editingSampleIndex, setEditingSampleIndex] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const isReady = !isEdit || Boolean(initialProblem);

  const allowedImageMimeTypes = useMemo(
    () => new Set(['image/png', 'image/jpeg', 'image/webp', 'image/avif']),
    []
  );
  const allowedImageExtensions = useMemo(
    () => new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']),
    []
  );

  const algorithmsQuery = useQuery({
    queryKey: ['problems', 'algorithms'],
    queryFn: async () => {
      const response = await authFetch('/api/problems/algorithms');
      return response?.items ?? [];
    },
    enabled: false,
    staleTime: 5 * 60 * 1000
  });

  const sourcesQuery = useQuery({
    queryKey: ['problems', 'sources'],
    queryFn: async () => {
      const response = await authFetch('/api/problems/sources');
      return response?.items ?? [];
    },
    enabled: isReady,
    staleTime: 5 * 60 * 1000
  });

  const languagesQuery = useQuery({
    queryKey: ['languages'],
    queryFn: async () => authFetch('/api/languages', {}, { skipAuth: true }),
    staleTime: 5 * 60 * 1000
  });

  useEffect(() => {
    if (!languagesQuery.isFetching && languagesQuery.data?.length) {
      const available = languagesQuery.data;
      const selectionExists = available.some((language) => String(language.id) === languageSelection);

      if (!selectionExists) {
        setLanguageSelection(String(available[0].id));
      }

      if (!selectedLanguages.length) {
        setSelectedLanguages([available[0].id]);
      }
    }
  }, [languageSelection, languagesQuery.data, languagesQuery.isFetching, selectedLanguages.length]);

  useEffect(() => {
    if (!isEdit || !initialProblem) {
      return;
    }

    setForm({
      title: initialProblem.title ?? '',
      statementMd: selectStatementSource(initialProblem.statementMd, initialProblem.statement),
      source: initialProblem.source ?? '',
      difficulty: initialProblem.difficulty ?? 'BASIC',
      isPublic: initialProblem.isPublic ?? true,
      inputFormat: initialProblem.inputFormat ?? '',
      outputFormat: initialProblem.outputFormat ?? '',
      constraints: initialProblem.constraints ?? '',
      cpuTimeLimit:
        typeof initialProblem.cpuTimeLimit === 'number'
          ? String(initialProblem.cpuTimeLimit)
          : initialProblem.cpuTimeLimit ?? '',
      memoryLimit:
        typeof initialProblem.memoryLimit === 'number'
          ? String(initialProblem.memoryLimit)
          : initialProblem.memoryLimit ?? '',
      tags: Array.isArray(initialProblem.tags) ? initialProblem.tags : [],
      algorithms: Array.isArray(initialProblem.algorithms) ? initialProblem.algorithms : []
    });

    const initialLanguages = Array.isArray(initialProblem.judge0LanguageIds)
      ? initialProblem.judge0LanguageIds.map((value) => Number(value))
      : [71];
    setSelectedLanguages(initialLanguages.length ? initialLanguages : [71]);
    setLanguageSelection(String((initialLanguages.length ? initialLanguages[0] : 71) ?? 71));

    setTestCases(
      (initialProblem.testCases ?? []).map((testCase) => ({
        uid: generateUid(),
        input: testCase.input,
        output: testCase.output,
        points: testCase.points ?? 1
      }))
    );

    setSamples(
      (initialProblem.samples ?? []).map((sample) => ({
        uid: generateUid(),
        input: sample.input,
        output: sample.output,
        explanation: sample.explanation ?? ''
      }))
    );

    setAlgorithmInput('');
    setTagInput('');
    setZipWarnings([]);
    setValidationResult(null);
    setValidationError('');
    setError('');
  }, [initialProblem, isEdit]);

  const resetForm = () => {
    setForm(buildDefaultForm());
    setTestCases([]);
    setSamples([]);
    setSelectedLanguages([71]);
    setLanguageSelection('71');
    setAlgorithmInput('');
    setTagInput('');
    setZipWarnings([]);
    setTrimWhitespace(true);
    setValidationResult(null);
    setValidationError('');
    setError('');
    setIsUploadingImage(false);
  };

  const validateMutation = useMutation({
    mutationFn: async ({ languageId, sourceCode }) => {
      const normalizedCases = testCases.map((testCase, index) => ({
        index: index + 1,
        input: testCase.input,
        output: testCase.output,
        points: testCase.points
      }));

      return authFetch('/api/judge/validate', {
        method: 'POST',
        body: {
          languageId,
          sourceCode,
          cpuTimeLimit: form.cpuTimeLimit ? Number(form.cpuTimeLimit) : undefined,
          memoryLimit: form.memoryLimit ? Number(form.memoryLimit) : undefined,
          testCases: normalizedCases
        }
      });
    },
    onSuccess: (response) => {
      setValidationResult(response);
      setValidationError('');
    },
    onError: (err) => {
      setValidationError(err.message || 'Failed to validate test cases');
      setValidationResult(null);
    }
  });

  const submitMutation = useMutation({
    mutationFn: async (payload) => {
      const endpoint = isEdit
        ? `/api/problems/${initialProblem?.problemId}`
        : '/api/problems';
      const method = isEdit ? 'PUT' : 'POST';
      return authFetch(endpoint, { method, body: payload });
    },
    onSuccess: (response) => {
      setError('');
      setValidationResult(null);
      setValidationError('');
      setZipWarnings([]);

      const problemId = response?.problemId ?? initialProblem?.problemId;

      if (isEdit) {
        if (problemId) {
          queryClient.invalidateQueries({ queryKey: ['problem', String(problemId)] });
        }
        queryClient.invalidateQueries({ queryKey: ['problems'] });
        queryClient.invalidateQueries({ queryKey: ['problems', 'algorithms'] });
        queryClient.invalidateQueries({ queryKey: ['problems', 'sources'] });
        setForm({
          title: response.title ?? form.title,
          statementMd: selectStatementSource(response.statementMd, response.statement),
          source: response.source ?? form.source ?? '',
          difficulty: response.difficulty ?? form.difficulty,
          isPublic: response.isPublic ?? form.isPublic,
          inputFormat: response.inputFormat ?? '',
          outputFormat: response.outputFormat ?? '',
          constraints: response.constraints ?? '',
          cpuTimeLimit:
            typeof response.cpuTimeLimit === 'number'
              ? String(response.cpuTimeLimit)
              : response.cpuTimeLimit ?? '',
          memoryLimit:
            typeof response.memoryLimit === 'number'
              ? String(response.memoryLimit)
              : response.memoryLimit ?? '',
          tags: Array.isArray(response.tags) ? response.tags : [],
          algorithms: Array.isArray(response.algorithms) ? response.algorithms : []
        });
        setTestCases(
          (response.testCases ?? []).map((testCase) => ({
            uid: generateUid(),
            input: testCase.input,
            output: testCase.output,
            points: testCase.points ?? 1
          }))
        );
        setSamples(
          (response.samples ?? []).map((sample) => ({
            uid: generateUid(),
            input: sample.input,
            output: sample.output,
            explanation: sample.explanation ?? ''
          }))
        );
        const nextLanguages = Array.isArray(response.judge0LanguageIds)
          ? response.judge0LanguageIds.map((value) => Number(value))
          : selectedLanguages;
        setSelectedLanguages(nextLanguages.length ? nextLanguages : [71]);
        setLanguageSelection(String((nextLanguages.length ? nextLanguages[0] : 71) ?? 71));
        onSuccess?.(response);
      } else {
        resetForm();
        queryClient.invalidateQueries({ queryKey: ['problems'] });
        queryClient.invalidateQueries({ queryKey: ['problems', 'algorithms'] });
        queryClient.invalidateQueries({ queryKey: ['problems', 'sources'] });
      }
    },
    onError: (err) => {
      setError(err.message || 'Failed to save problem');
    }
  });

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (event) => {
    const { name, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: checked }));
  };

  const canAddMoreAlgorithms = form.algorithms.length < 10;
  const canAddMoreTags = form.tags.length < 20;

  const handleAlgorithmAdd = (rawValue) => {
    if (!canAddMoreAlgorithms) {
      return;
    }
    const normalized = String(rawValue ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!normalized) {
      return;
    }
    if (form.algorithms.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
      setAlgorithmInput('');
      return;
    }
    setForm((prev) => ({ ...prev, algorithms: [...prev.algorithms, normalized] }));
    setAlgorithmInput('');
  };

  const handleAlgorithmRemove = (value) => {
    setForm((prev) => ({
      ...prev,
      algorithms: prev.algorithms.filter((algorithm) => algorithm !== value)
    }));
  };

  const handleAlgorithmKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      handleAlgorithmAdd(algorithmInput);
    } else if (event.key === 'Backspace' && !algorithmInput && form.algorithms.length) {
      const next = [...form.algorithms];
      next.pop();
      setForm((prev) => ({ ...prev, algorithms: next }));
    }
  };

  const handleTagAdd = (rawValue) => {
    if (!canAddMoreTags) {
      return;
    }
    const normalized = String(rawValue ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!normalized) {
      return;
    }
    if (form.tags.some((tag) => tag.toLowerCase() === normalized.toLowerCase())) {
      setTagInput('');
      return;
    }
    setForm((prev) => ({ ...prev, tags: [...prev.tags, normalized] }));
    setTagInput('');
  };

  const handleTagRemove = (value) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== value)
    }));
  };

  const handleTagKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      handleTagAdd(tagInput);
    } else if (event.key === 'Backspace' && !tagInput && form.tags.length) {
      const next = [...form.tags];
      next.pop();
      setForm((prev) => ({ ...prev, tags: next }));
    }
  };

  const suggestedAlgorithms = useMemo(() => {
    const source = algorithmsQuery.data ?? [];
    const selected = new Set(form.algorithms.map((item) => item.toLowerCase()));
    const searchTerm = algorithmInput.trim().toLowerCase();
    return source
      .filter((item) => !selected.has(item.toLowerCase()))
      .filter((item) => !searchTerm || item.toLowerCase().includes(searchTerm))
      .slice(0, 8);
  }, [algorithmInput, algorithmsQuery.data, form.algorithms]);

  const handleAddLanguage = () => {
    const value = Number(languageSelection);
    if (!Number.isFinite(value)) {
      return;
    }
    setSelectedLanguages((prev) => (prev.includes(value) ? prev : [...prev, value]));
  };

  const handleRemoveLanguage = (value) => {
    setSelectedLanguages((prev) => prev.filter((item) => item !== value));
  };

  const handleOpenAddTestCase = () => {
    setEditingTestCaseIndex(null);
    setIsTestCaseModalOpen(true);
  };

  const handleEditTestCase = (index) => {
    setEditingTestCaseIndex(index);
    setIsTestCaseModalOpen(true);
  };

  const handleDeleteTestCase = (index) => {
    setTestCases((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveTestCase = (nextTestCase) => {
    setTestCases((prev) => {
      if (editingTestCaseIndex !== null) {
        return prev.map((item, idx) =>
          idx === editingTestCaseIndex ? { ...item, ...nextTestCase } : item
        );
      }
      return [...prev, { uid: generateUid(), ...nextTestCase }];
    });
    setIsTestCaseModalOpen(false);
    setEditingTestCaseIndex(null);
    setError('');
  };

  const handleOpenAddSample = () => {
    setEditingSampleIndex(null);
    setIsSampleModalOpen(true);
  };

  const handleEditSample = (index) => {
    setEditingSampleIndex(index);
    setIsSampleModalOpen(true);
  };

  const handleDeleteSample = (index) => {
    setSamples((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveSample = (nextSample) => {
    setSamples((prev) => {
      if (editingSampleIndex !== null) {
        return prev.map((item, idx) =>
          idx === editingSampleIndex
            ? { ...item, ...nextSample, explanation: nextSample.explanation ?? '' }
            : item
        );
      }
      return [
        ...prev,
        { uid: generateUid(), ...nextSample, explanation: nextSample.explanation ?? '' }
      ];
    });
    setIsSampleModalOpen(false);
    setEditingSampleIndex(null);
    setError('');
  };

  const handleZipUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('trimWhitespace', trimWhitespace ? 'true' : 'false');

    try {
      const response = await authFetch('/api/problems/testcases/zip-parse', {
        method: 'POST',
        body: formData
      });

      const parsed = (response?.testCases ?? []).map((item) => ({
        uid: generateUid(),
        input: item.input,
        output: item.output,
        points: item.points ?? 1
      }));

      if (!parsed.length) {
        setError('No valid test case pairs were found in the archive.');
      } else {
        setTestCases(parsed);
        setError('');
      }

      setZipWarnings(response?.warnings ?? []);
    } catch (uploadError) {
      setError(uploadError.message || 'Failed to parse test case archive');
    } finally {
      event.target.value = '';
    }
  };

  const handleValidateTestCases = () => {
    if (!testCases.length) {
      setError('At least one test case is required before validation.');
      return;
    }
    if (!(languages ?? []).length) {
      setError('Programming languages are still loading. Please try again shortly.');
      return;
    }
    setValidationResult(null);
    setValidationError('');
    setValidationModalOpen(true);
  };

  const handleValidationSubmit = ({ languageId, sourceCode }) => {
    validateMutation.mutate({ languageId, sourceCode });
  };

  const insertImageMarkdown = (url) => {
    const textarea = statementTextareaRef.current;
    setForm((prev) => {
      const start = textarea?.selectionStart ?? prev.statementMd.length;
      const end = textarea?.selectionEnd ?? start;
      const before = prev.statementMd.slice(0, start);
      const after = prev.statementMd.slice(end);
      const prefix = before.length === 0 ? '' : before.endsWith('\n') ? '\n' : '\n\n';
      const suffix = after.length === 0 ? '\n\n' : after.startsWith('\n') ? '\n' : '\n\n';
      const snippet = `${prefix}![](${url})${suffix}`;
      const nextValue = `${before}${snippet}${after}`;
      const cursor = before.length + snippet.length;

      const scheduler =
        typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
          ? window.requestAnimationFrame
          : (cb) => setTimeout(cb, 0);
      scheduler(() => {
        const target = statementTextareaRef.current;
        if (target) {
          target.focus();
          target.setSelectionRange(cursor, cursor);
        }
      });

      return { ...prev, statementMd: nextValue };
    });
  };

  const handleImageUploadClick = () => {
    if (!isReady || isUploadingImage) {
      return;
    }
    imageInputRef.current?.click();
  };

  const handleImageFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const extension =
      file.name && file.name.includes('.')
        ? file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
        : '';

    if (!allowedImageMimeTypes.has(file.type) && !allowedImageExtensions.has(extension)) {
      setError('Only PNG, JPG, JPEG, WEBP, or AVIF images are supported.');
      event.target.value = '';
      return;
    }

    setIsUploadingImage(true);
    try {
      setError('');
      const formData = new FormData();
      formData.append('file', file);
      const response = await authFetch('/api/uploads/images', {
        method: 'POST',
        body: formData
      });

      if (!response?.url) {
        throw new Error('Image upload failed');
      }

      const rawUrl =
        typeof response.apiPath === 'string'
          ? response.apiPath
          : typeof response.url === 'string'
            ? response.url
            : response.path;
      const markdownUrl = (() => {
        if (!rawUrl) {
          return rawUrl;
        }
        if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
          return rawUrl;
        }
        const base = import.meta.env.VITE_API_URL || '';
        if (!base) {
          return rawUrl;
        }
        try {
          const absolute = new URL(rawUrl, base).toString();
          return absolute;
        } catch (_error) {
          return rawUrl;
        }
      })();
      insertImageMarkdown(markdownUrl);
    } catch (uploadError) {
      setError(uploadError.message || 'Failed to upload image');
    } finally {
      setIsUploadingImage(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!testCases.length) {
      setError('At least one test case is required.');
      return;
    }

    if (!selectedLanguages.length) {
      setError('Select at least one Judge0 language.');
      return;
    }

    if (!form.statementMd.trim()) {
      setError('Problem statement cannot be empty.');
      return;
    }

    const statementMarkdown = form.statementMd;

    const payload = {
      title: form.title.trim(),
      statementMd: statementMarkdown,
      statement: statementMarkdown,
      difficulty: form.difficulty,
      isPublic: form.isPublic,
      inputFormat: form.inputFormat || undefined,
      outputFormat: form.outputFormat || undefined,
      constraints: form.constraints || undefined,
      judge0LanguageIds: selectedLanguages,
      samples: samples.map((sample) => {
        const next = {
          input: sample.input,
          output: sample.output
        };
        if (sample.explanation?.trim()) {
          next.explanation = sample.explanation.trim();
        }
        return next;
      }),
      testCases: testCases.map((testCase) => ({
        input: testCase.input,
        output: testCase.output,
        points: testCase.points
      })),
      algorithms: form.algorithms,
      tags: form.tags,
      source: form.source,
      cpuTimeLimit: form.cpuTimeLimit ? Number(form.cpuTimeLimit) : undefined,
      memoryLimit: form.memoryLimit ? Number(form.memoryLimit) : undefined
    };

    submitMutation.mutate(payload);
  };

  const totalPoints = useMemo(
    () => testCases.reduce((sum, testCase) => sum + (testCase.points || 0), 0),
    [testCases]
  );

  const editingTestCase =
    editingTestCaseIndex !== null ? testCases[editingTestCaseIndex] : undefined;
  const editingSample =
    editingSampleIndex !== null ? samples[editingSampleIndex] : undefined;

  const languages = languagesQuery.data ?? [];
  const selectedLanguageObjects = languages.filter((lang) => selectedLanguages.includes(lang.id));
  const sourceOptions = sourcesQuery.data ?? [];

  const submitLabel = isEdit ? 'Update problem' : 'Create problem';
  const submitBusyLabel = isEdit ? 'Updating…' : 'Creating…';
  const isSubmitting = submitMutation.isLoading;

  return (
    <section className="page admin-create-page">
      <header className="page-header">
        <div>
          <h1>{isEdit ? 'Edit Problem' : 'Create Problem'}</h1>
          <p>
            {isEdit
              ? 'Update the problem statement, constraints, and testing data.'
              : 'Enhance the problem set with new statements and thorough test coverage.'}
          </p>
        </div>
      </header>

      <form className="admin-card" onSubmit={handleSubmit}>
        <label>
          Title
          <input
            name="title"
            value={form.title}
            onChange={handleInputChange}
            required
            disabled={!isReady}
          />
        </label>

        <label>
          Difficulty
          <select
            name="difficulty"
            value={form.difficulty}
            onChange={handleInputChange}
            disabled={!isReady}
          >
            <option value="BASIC">BASIC</option>
            <option value="EASY">EASY</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HARD">HARD</option>
          </select>
        </label>

        <label className="checkbox">
          <input
            type="checkbox"
            name="isPublic"
            checked={form.isPublic}
            onChange={handleCheckboxChange}
            disabled={!isReady}
          />
          Public
        </label>

        <label htmlFor="problem-source-input">
          Source
          <input
            id="problem-source-input"
            name="source"
            list="problem-source-options"
            value={form.source}
            onChange={handleInputChange}
            disabled={!isReady}
            placeholder="e.g. BOJ"
          />
        </label>
        <datalist id="problem-source-options">
          {sourceOptions.map((source) => (
            <option key={source} value={source} />
          ))}
        </datalist>

        <div className="markdown-editor">
          <div className="markdown-editor__header">
            <div className="markdown-editor__title">
              <label htmlFor="problem-statement-input">Statement</label>
              <span className="markdown-editor__hint">Markdown + LaTeX supported</span>
            </div>
            <div className="markdown-editor__actions">
              {isUploadingImage && (
                <span className="markdown-editor__uploading">Uploading image…</span>
              )}
              <button
                type="button"
                className="secondary"
                onClick={handleImageUploadClick}
                disabled={!isReady || isUploadingImage}
              >
                {isUploadingImage ? 'Uploading…' : 'Insert Image'}
              </button>
            </div>
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.avif"
            style={{ display: 'none' }}
            onChange={handleImageFileChange}
          />
          <div className="markdown-editor__panes">
            <textarea
              id="problem-statement-input"
              name="statementMd"
              value={form.statementMd}
              onChange={handleInputChange}
              rows={12}
              required
              disabled={!isReady}
              placeholder="Describe the problem. Use $...$ for inline math and $$...$$ for displayed equations."
              ref={statementTextareaRef}
            />
            <div className="markdown-editor__preview" aria-live="polite">
              <div className="markdown-editor__preview-header">Preview</div>
              <div className="markdown-editor__preview-body">
                {form.statementMd.trim() ? (
                  <ProblemStatement source={form.statementMd} />
                ) : (
                  <p className="markdown-editor__empty">
                    Start typing to see the rendered Markdown preview. Inline math uses $a^2 + b^2 =
                    c^2$ and blocks use $$\int_0^1 x^2 dx$$.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <label>
          Input Format
          <textarea
            name="inputFormat"
            value={form.inputFormat}
            onChange={handleInputChange}
            rows={3}
            disabled={!isReady}
          />
        </label>

        <label>
          Output Format
          <textarea
            name="outputFormat"
            value={form.outputFormat}
            onChange={handleInputChange}
            rows={3}
            disabled={!isReady}
          />
        </label>

        <label>
          Constraints
          <textarea
            name="constraints"
            value={form.constraints}
            onChange={handleInputChange}
            rows={3}
            disabled={!isReady}
          />
        </label>

        <div className="grid-two-columns">
          <label>
            CPU Time Limit (seconds)
            <input
              name="cpuTimeLimit"
              type="number"
              min="0.1"
              max="30"
              step="0.1"
              value={form.cpuTimeLimit}
              onChange={handleInputChange}
              disabled={!isReady}
            />
          </label>
          <label>
            Memory Limit (MB)
            <input
              name="memoryLimit"
              type="number"
              min="16"
              max="1024"
              value={form.memoryLimit}
              onChange={handleInputChange}
              disabled={!isReady}
            />
          </label>
        </div>

        <label>
          Tags
          <div className="algorithm-field">
            <div className="algorithm-chips">
              {form.tags.map((tag) => (
                <span key={tag} className="algorithm-chip">
                  {tag}
                  <button
                    type="button"
                    aria-label={`Remove ${tag}`}
                    onClick={() => handleTagRemove(tag)}
                  >
                    ×
                  </button>
                </span>
              ))}
              {canAddMoreTags && (
                <input
                  type="text"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Add tag (press Enter)"
                  disabled={!isReady}
                />
              )}
            </div>
            {!canAddMoreTags && (
              <div className="algorithm-helper">Maximum of 20 tags reached.</div>
            )}
          </div>
        </label>

        <label>
          Algorithms
          <div className="algorithm-field">
            <div className="algorithm-chips">
              {form.algorithms.map((algorithm) => (
                <span key={algorithm} className="algorithm-chip">
                  {algorithm}
                  <button
                    type="button"
                    aria-label={`Remove ${algorithm}`}
                    onClick={() => handleAlgorithmRemove(algorithm)}
                  >
                    ×
                  </button>
                </span>
              ))}
              {canAddMoreAlgorithms && (
                <input
                  type="text"
                  value={algorithmInput}
                  onChange={(event) => setAlgorithmInput(event.target.value)}
                  onFocus={() => {
                    setShowSuggestions(true);
                    if (!algorithmsQuery.isFetched && !algorithmsQuery.isFetching) {
                      algorithmsQuery.refetch();
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 120);
                  }}
                  onKeyDown={handleAlgorithmKeyDown}
                  placeholder={
                    algorithmsQuery.isFetching
                      ? 'Loading algorithms…'
                      : 'Add algorithm (press Enter)'
                  }
                  disabled={!isReady}
                />
              )}
            </div>
            {showSuggestions && suggestedAlgorithms.length > 0 && (
              <div className="algorithm-suggestions">
                {suggestedAlgorithms.map((option) => (
                  <button
                    type="button"
                    key={option}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleAlgorithmAdd(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
            {!canAddMoreAlgorithms && (
              <div className="algorithm-helper">Maximum of 10 algorithms reached.</div>
            )}
          </div>
        </label>

        <div className="language-picker">
          <h3>Judge0 Languages</h3>
          <div className="language-picker__content">
            <select
              value={languageSelection}
              onChange={(event) => setLanguageSelection(event.target.value)}
              disabled={!isReady}
            >
              {(languages ?? []).map((language) => (
                <option key={language.id} value={language.id}>
                  {language.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="secondary"
              onClick={handleAddLanguage}
              disabled={!isReady}
            >
              Add Language
            </button>
          </div>
          <div className="language-chips">
            {selectedLanguageObjects.map((language) => (
              <span key={language.id} className="algorithm-chip">
                {language.name}
                <button type="button" onClick={() => handleRemoveLanguage(language.id)}>
                  ×
                </button>
              </span>
            ))}
            {!selectedLanguageObjects.length && (
              <span className="helper-text">No languages selected.</span>
            )}
          </div>
        </div>

        <section className="testcase-section">
          <header className="testcase-section__header">
            <h3>Samples</h3>
            <span>{samples.length ? `${samples.length} sample(s)` : 'Optional'}</span>
          </header>

          <div className="testcase-toolbar">
            <button
              type="button"
              className="secondary"
              onClick={handleOpenAddSample}
              disabled={!isReady}
            >
              Add Sample
            </button>
          </div>

          {samples.length ? (
            <table className="testcase-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Input</th>
                  <th>Output</th>
                  <th>Explanation</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((sample, index) => (
                  <tr key={sample.uid}>
                    <td>{index + 1}</td>
                    <td>
                      <pre>{sample.input}</pre>
                    </td>
                    <td>
                      <pre>{sample.output}</pre>
                    </td>
                    <td>{sample.explanation ? sample.explanation : '—'}</td>
                    <td className="testcase-table__actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleEditSample(index)}
                        disabled={!isReady}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDeleteSample(index)}
                        disabled={!isReady}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="testcase-empty">Add sample cases to illustrate input and output.</div>
          )}
        </section>

        <section className="testcase-section">
          <header className="testcase-section__header">
            <h3>Test Cases</h3>
            <span>
              {testCases.length} case{testCases.length === 1 ? '' : 's'} · {totalPoints} point
              {totalPoints === 1 ? '' : 's'}
            </span>
          </header>

          <div className="testcase-toolbar">
            <button
              type="button"
              className="secondary"
              onClick={handleOpenAddTestCase}
              disabled={!isReady}
            >
              Add Test Case
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isReady}
            >
              Upload ZIP
            </button>
            <button type="button" onClick={handleValidateTestCases} disabled={!isReady}>
              Validate Test Cases
            </button>
          </div>

          <div className="zip-options">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={trimWhitespace}
                onChange={(event) => setTrimWhitespace(event.target.checked)}
                disabled={!isReady}
              />
              Trim trailing whitespace on import
            </label>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            style={{ display: 'none' }}
            onChange={handleZipUpload}
          />

          {zipWarnings.length > 0 && (
            <div className="zip-warnings">
              <strong>Import warnings:</strong>
              <ul>
                {zipWarnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {testCases.length ? (
            <table className="testcase-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Input</th>
                  <th>Output</th>
                  <th>Points</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {testCases.map((testCase, index) => (
                  <tr key={testCase.uid}>
                    <td>{index + 1}</td>
                    <td>
                      <pre>{testCase.input}</pre>
                    </td>
                    <td>
                      <pre>{testCase.output}</pre>
                    </td>
                    <td>{testCase.points}</td>
                    <td className="testcase-table__actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleEditTestCase(index)}
                        disabled={!isReady}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDeleteTestCase(index)}
                        disabled={!isReady}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="testcase-empty">Add or import test cases to continue.</div>
          )}
        </section>

        <button type="submit" disabled={isSubmitting || !isReady}>
          {isSubmitting ? submitBusyLabel : submitLabel}
        </button>

        {error && <div className="form-message error">{error}</div>}
      </form>

      <TestCaseModal
        open={isTestCaseModalOpen}
        initialValue={editingTestCase}
        onCancel={() => {
          setIsTestCaseModalOpen(false);
          setEditingTestCaseIndex(null);
        }}
        onSave={handleSaveTestCase}
      />

      <SampleModal
        open={isSampleModalOpen}
        initialValue={editingSample}
        onCancel={() => {
          setIsSampleModalOpen(false);
          setEditingSampleIndex(null);
        }}
        onSave={handleSaveSample}
      />

      <ValidateTestCasesModal
        open={validationModalOpen}
        languages={languages}
        defaultLanguageId={selectedLanguages[0] ?? languages[0]?.id}
        isLoading={validateMutation.isLoading}
        error={validationError}
        onCancel={() => setValidationModalOpen(false)}
        onSubmit={handleValidationSubmit}
        validationResult={validationResult}
        totalPoints={totalPoints}
      />
    </section>
  );
}

export default ProblemEditor;
