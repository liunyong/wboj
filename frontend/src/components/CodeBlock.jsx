import { useEffect, useRef } from 'react';

function CodeBlock({ code, language }) {
  const codeRef = useRef(null);

  useEffect(() => {
    const node = codeRef.current;
    if (!node) {
      return;
    }
    const value = typeof code === 'string' ? code : '';
    node.textContent = value;
  }, [code]);

  const languageClass =
    language && typeof language === 'string'
      ? ` language-${language.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`
      : '';

  return (
    <pre>
      <code ref={codeRef} className={`code-block${languageClass}`} />
    </pre>
  );
}

export default CodeBlock;
