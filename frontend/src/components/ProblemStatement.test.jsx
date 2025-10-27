import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ProblemStatement from './ProblemStatement.jsx';

describe('ProblemStatement', () => {
  it('renders inline and block math using KaTeX', () => {
    const { container } = render(
      <ProblemStatement source={'Energy $E=mc^2$\n\n$$\\int_0^1 x^2 \\,dx = \\tfrac{1}{3}$$'} />
    );

    const katexNodes = container.querySelectorAll('.katex');
    expect(katexNodes.length).toBeGreaterThanOrEqual(2);

    const displayMath = container.querySelector('.katex-display');
    expect(displayMath).not.toBeNull();
    expect(displayMath?.textContent?.replace(/\s+/g, ' ').trim()).toContain('∫');
  });

  it('strips script tags from the rendered output', () => {
    const { container } = render(<ProblemStatement source={'Safe<script>alert(1)</script>'} />);

    expect(screen.getByText('Safe')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
  });

  it('renders images with whitelisted sources', () => {
    const { container } = render(
      <ProblemStatement source={'<img src="/uploads/problems/example.png" alt="Example" onerror="alert(1)">'} />
    );

    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('src')).toBe('/uploads/problems/example.png');
    expect(image?.hasAttribute('onerror')).toBe(false);
  });

  it('allows api uploads image paths', () => {
    const { container } = render(
      <ProblemStatement source={'![](/api/uploads/problems/example.png)'} />
    );

    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('src')).toBe('/api/uploads/problems/example.png');
  });

  it('removes markdown images with unsafe protocols', () => {
    render(<ProblemStatement source={'![Attack](javascript:alert(1))'} />);

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Attack')).toBeInTheDocument();
  });
});
