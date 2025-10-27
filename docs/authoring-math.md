# Authoring Markdown and Math for WBOJ Problems

Problem statements, samples, and format sections now accept **GitHub-flavoured Markdown** with **KaTeX** math rendering. The preview in the problem editor matches the reader shown on the problem page, so anything you see in the preview is exactly what contestants will see.

## Inline math

Wrap expressions in single dollar signs to render them inline with text:

```markdown
The famous equation $E = mc^2$ relates energy and mass.
```

## Block math

Use double dollar signs on their own lines for display equations:

```markdown
The definite integral evaluates to

$$
\int_0^1 x^2 \, dx = \tfrac{1}{3}.
$$
```

## Images

- In the editor, use **Insert Image** to upload PNG, JPG/JPEG, WEBP, or AVIF files (max 5&nbsp;MB).
- Uploaded files are stored under `/uploads/problems/...` and the editor automatically inserts the corresponding `![](/uploads/...)` Markdown snippet at your cursor.
- Image sources are sanitised server-side: inline styles, `javascript:` URLs, SVG/GIF files, and event handlers are stripped before saving.
- You can still tweak the alt text manually after insertion by editing the Markdown.

## Helpful tips

- Most Markdown syntax works as expected: headings, tables, lists, code blocks, and blockquotes.
- KaTeX commands follow LaTeX math mode (e.g. `\frac`, `\sqrt`, `\sum`); escape backslashes in code blocks when copying examples.
- Problem content is sanitised automatically. Inline HTML that introduces scripts, event handlers, or `javascript:` links is stripped before saving, so keep everything in Markdown/KaTeX.
- Use the editor preview to double-check formatting before publishing.
