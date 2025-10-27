import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import { sanitizeMarkdownSource } from '../utils/markdown.js';

const DEFAULT_CLASSNAME = 'markdown-body';

function ProblemStatement({ source, className = DEFAULT_CLASSNAME, components, ...rest }) {
  const sanitized = useMemo(() => sanitizeMarkdownSource(source), [source]);
  if (!sanitized || !sanitized.trim()) {
    return null;
  }

  return (
    <ReactMarkdown
      className={className}
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={components}
      {...rest}
    >
      {sanitized}
    </ReactMarkdown>
  );
}

export default ProblemStatement;
