import 'katex/dist/katex.min.css';
import { Children, isValidElement, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';

import CodeBlock from './CodeBlock.jsx';
import { sanitizeMarkdownSource } from '../utils/markdown.js';

const DEFAULT_CLASSNAME = 'markdown-body';
const LANGUAGE_CLASS_REGEX = /language-([a-z0-9_+-]+)/i;

const extractCodeText = (children) => {
  if (Array.isArray(children)) {
    return children.map((node) => (typeof node === 'string' ? node : String(node ?? ''))).join('');
  }
  return typeof children === 'string' ? children : String(children ?? '');
};

function ProblemStatement({ source, className = DEFAULT_CLASSNAME, components, ...rest }) {
  const sanitized = useMemo(() => sanitizeMarkdownSource(source), [source]);
  const markdownComponents = useMemo(
    () => ({
      // react-markdown v9 identifies blocks by <pre>; code has no inline prop.
      pre({ node, children, ...preProps }) {
        const codeElement = Children.toArray(children)[0];
        if (node.children.length !== 1 || !isValidElement(codeElement) || codeElement.type !== 'code') {
          return <pre {...preProps}>{children}</pre>;
        }

        const { className: codeClassName, children: codeChildren } = codeElement.props;
        const language = codeClassName?.match(LANGUAGE_CLASS_REGEX)?.[1] ?? '';
        const code = extractCodeText(codeChildren).replace(/\n$/, '');
        return <CodeBlock code={code} language={language} />;
      },
      ...(components ?? {})
    }),
    [components]
  );

  if (!sanitized || !sanitized.trim()) {
    return null;
  }

  return (
    <ReactMarkdown
      className={className}
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeRaw, rehypeKatex]}
      components={markdownComponents}
      {...rest}
    >
      {sanitized}
    </ReactMarkdown>
  );
}

export default ProblemStatement;
